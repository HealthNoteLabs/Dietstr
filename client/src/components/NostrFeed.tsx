import React, { useState, useEffect, useCallback, useContext } from 'react';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { ndk, initializeNostr, formatNostrContent, extractImageUrls } from '../utils/nostr';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Avatar } from './ui/avatar';
import { Card } from './ui/card';
import { Loader2, MessageSquare, Heart, Repeat, Zap } from 'lucide-react';

// Define diet-related hashtags for filtering
const DIET_HASHTAGS = ["Foodstr", "Dietstr", "Food", "Diet", "Carnivore", "Fasting", "Hydration"];

interface NostrProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  website?: string;
  lud06?: string;
  lud16?: string;
  nip05?: string;
}

interface NostrAuthor {
  pubkey: string;
  profile: NostrProfile;
  lud16?: string;
  lud06?: string;
}

interface NostrComment {
  id: string;
  content: string;
  created_at: number;
  author: NostrAuthor;
}

interface NostrPost {
  id: string;
  content: string;
  created_at: number;
  author: NostrAuthor;
  comments: NostrComment[];
  showComments: boolean;
  likes: number;
  reposts: number;
  zaps: number;
  zapAmount: number;
  hasFullData: boolean;
  images?: string[];
}

export const NostrFeed: React.FC = () => {
  const [posts, setPosts] = useState<NostrPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const { defaultZapAmount } = useContext(NostrContext);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userReposts, setUserReposts] = useState<Set<string>>(new Set());
  const { wallet, isLoggedIn, login } = useAuth();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState<Set<string>>(new Set());
  const [activePostForComment, setActivePostForComment] = useState<string | null>(null);

  const processBasicPostData = useCallback(async (newPosts: NDKEvent[]) => {
    try {
      if (!newPosts || newPosts.length === 0) {
        return [];
      }

      console.log('Processing basic post data for', newPosts.length, 'posts');
      const authors = [...new Set(newPosts.map((post) => post.pubkey))];
      
      const profileEvents = await ndk.fetchEvents({
        kinds: [0], // Metadata events
        authors
      });

      const profileMap = new Map(
        Array.from(profileEvents).map((profile) => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      return newPosts
        .map((post) => {
          const profile = profileMap.get(post.pubkey) || {};
          // Extract image URLs from post content
          const imageUrls = extractImageUrls(post.content);
          
          return {
            id: post.id,
            content: post.content,
            created_at: post.created_at,
            author: {
              pubkey: post.pubkey,
              profile: profile,
              lud16: profile.lud16,
              lud06: profile.lud06
            },
            comments: [],
            showComments: false,
            likes: 0,
            reposts: 0,
            zaps: 0,
            zapAmount: 0,
            hasFullData: false,
            images: imageUrls
          };
        })
        .sort((a, b) => b.created_at - a.created_at);
    } catch (err) {
      console.error('Error processing basic post data:', err);
      return newPosts.map(post => ({
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        author: {
          pubkey: post.pubkey,
          profile: {}
        },
        comments: [],
        showComments: false,
        likes: 0,
        reposts: 0,
        zaps: 0,
        zapAmount: 0,
        hasFullData: false,
        images: []
      })).sort((a, b) => b.created_at - a.created_at);
    }
  }, []);

  const loadSupplementaryData = useCallback(async (postId: string) => {
    if (loadedSupplementaryData.has(postId)) {
      return;
    }

    console.log('Loading supplementary data for post:', postId);
    setLoadedSupplementaryData(prev => new Set([...prev, postId]));

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    
    const post = posts[postIndex];
    
    const [comments, likes, reposts, zapReceipts] = await Promise.all([
      ndk.fetchEvents({
        kinds: [1], // Regular notes as comments
        '#e': [postId] // Reference to the post
      }),
      ndk.fetchEvents({
        kinds: [7], // Reactions (likes)
        '#e': [postId]
      }),
      ndk.fetchEvents({
        kinds: [6], // Reposts
        '#e': [postId]
      }),
      ndk.fetchEvents({
        kinds: [9735], // Zap receipts
        '#e': [postId]
      })
    ]);

    const commentAuthors = [...new Set(Array.from(comments).map(c => c.pubkey))];
    
    const commentProfileEvents = commentAuthors.length > 0 ? await ndk.fetchEvents({
      kinds: [0], // Metadata
      authors: commentAuthors
    }) : new Set();

    const profileMap = new Map(
      Array.from(commentProfileEvents).map((profile) => {
        try {
          return [profile.pubkey, JSON.parse(profile.content)];
        } catch (err) {
          console.error('Error parsing profile:', err);
          return [profile.pubkey, {}];
        }
      })
    );

    let userPubkey = '';
    try {
      if (window.nostr) {
        userPubkey = await window.nostr.getPublicKey();
      }
    } catch (err) {
      console.error('Error getting user pubkey:', err);
    }

    // Process likes
    let likesCount = 0;
    let userLiked = false;
    Array.from(likes).forEach(like => {
      likesCount++;
      if (like.pubkey === userPubkey) {
        userLiked = true;
      }
    });

    // Process reposts
    let repostsCount = 0;
    let userReposted = false;
    Array.from(reposts).forEach(repost => {
      repostsCount++;
      if (repost.pubkey === userPubkey) {
        userReposted = true;
      }
    });

    // Process zaps
    let zapCount = 0;
    let zapAmount = 0;
    Array.from(zapReceipts).forEach(zapReceipt => {
      try {
        zapCount++;
        
        const amountTag = zapReceipt.tags.find(tag => tag[0] === 'amount');
        if (amountTag && amountTag[1]) {
          zapAmount += parseInt(amountTag[1], 10) / 1000; // Convert msats to sats
        }
      } catch (err) {
        console.error('Error processing zap receipt:', err);
      }
    });

    // Process comments
    const processedComments = Array.from(comments).map((comment) => {
      const profile = profileMap.get(comment.pubkey) || {};
      return {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        author: {
          pubkey: comment.pubkey,
          profile: profile
        }
      };
    }).sort((a, b) => a.created_at - b.created_at);

    // Update user interactions
    if (userLiked) {
      setUserLikes(prev => new Set([...prev, postId]));
    }
    
    if (userReposted) {
      setUserReposts(prev => new Set([...prev, postId]));
    }

    // Update post with all data
    const updatedPost = {
      ...post,
      comments: processedComments,
      likes: likesCount,
      reposts: repostsCount,
      zaps: zapCount,
      zapAmount: zapAmount,
      hasFullData: true
    };

    setPosts(currentPosts => {
      const newPosts = [...currentPosts];
      newPosts[postIndex] = updatedPost;
      return newPosts;
    });

  }, [posts, loadedSupplementaryData]);

  const processAndUpdatePosts = useCallback(async (newPosts: NDKEvent[], append = false) => {
    if (!newPosts || newPosts.length === 0) {
      if (!append) {
        setPosts([]);
      }
      return [];
    }
    
    return await processBasicPostData(newPosts);
  }, [processBasicPostData]);

  const fetchFoodPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await initializeNostr();

      const limit = 20;
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
  
      // Fetch posts with diet-related hashtags
      const foodPosts = await ndk.fetchEvents({
        kinds: [1],  // Regular notes
        limit,
        since,
        "#t": DIET_HASHTAGS  // Filter by our diet hashtags
      });

      const postsArray = Array.from(foodPosts).sort((a, b) => b.created_at - a.created_at);
      
      if (postsArray.length < limit) {
        setHasMore(false);
      }
      
      const processedPosts = await processAndUpdatePosts(postsArray, page > 1);
      
      if (page === 1) {
        setPosts(processedPosts);
      } else {
        setPosts(prevPosts => [...prevPosts, ...processedPosts]);
      }
      
      setInitialLoadComplete(true);
    } catch (err) {
      console.error('Error fetching food posts:', err);
      setError('Failed to load posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [page, processAndUpdatePosts]);

  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (mounted) {
        await fetchFoodPosts();
      }
    };
    
    init();

    return () => {
      mounted = false;
    };
  }, [fetchFoodPosts, page]);
  
  // Connect to WebSocket server for real-time updates
  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    
    // Connection opened
    socket.addEventListener('open', (event) => {
      console.log('Connected to WebSocket server');
      
      // Subscribe to food-related feed updates
      socket.send(JSON.stringify({
        type: 'subscribe',
        feed: 'food'
      }));
    });
    
    // Listen for messages
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Handle different message types
        if (data.type === 'new_post') {
          // Add new post to the feed
          console.log('New post received:', data.data);
          // Would need to refresh or add post to the feed
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Listen for errors
    socket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
    });
    
    // Clean up on unmount
    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 300
      ) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts]);

  const handleCommentClick = (postId: string) => {
    if (!loadedSupplementaryData.has(postId)) {
      loadSupplementaryData(postId);
    }
    
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? { ...post, showComments: !post.showComments }
          : post
      )
    );
  };

  const handleLike = async (post: NostrPost) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }
    
    if (!window.nostr) {
      const result = await login();
      if (!result) return;
    }

    try {
      const likeEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: '+',
        tags: [
          ['e', post.id],
          ['p', post.author.pubkey]
        ]
      };

      const signedEvent = await window.nostr?.signEvent(likeEvent);
      if (!signedEvent) return;

      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      setUserLikes(prev => {
        const newLikes = new Set(prev);
        newLikes.add(post.id);
        return newLikes;
      });

      setPosts(currentPosts => {
        return currentPosts.map(p => 
          p.id === post.id 
            ? { ...p, likes: p.likes + 1 } 
            : p
        );
      });

      console.log('Post liked successfully');
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Failed to like post. Please try again.');
    }
  };

  const handleRepost = async (post: NostrPost) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }
    
    if (!window.nostr) {
      const result = await login();
      if (!result) return;
    }

    try {
      const repostEvent = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', post.id, '', 'mention'],
          ['p', post.author.pubkey]
        ]
      };

      const signedEvent = await window.nostr?.signEvent(repostEvent);
      if (!signedEvent) return;

      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      setUserReposts(prev => {
        const newReposts = new Set(prev);
        newReposts.add(post.id);
        return newReposts;
      });

      setPosts(currentPosts => {
        return currentPosts.map(p => 
          p.id === post.id 
            ? { ...p, reposts: p.reposts + 1 } 
            : p
        );
      });

      console.log('Post reposted successfully');
    } catch (error) {
      console.error('Error reposting:', error);
      alert('Failed to repost. Please try again.');
    }
  };

  const handleZap = async (post: NostrPost) => {
    if (!loadedSupplementaryData.has(post.id)) {
      await loadSupplementaryData(post.id);
    }

    if (!window.nostr) {
      const result = await login();
      if (!result) return;
    }

    if (!wallet.available) {
      alert('Please connect a Bitcoin wallet to send zaps');
      return;
    }

    try {
      if (!post.author.lud16 && !post.author.lud06) {
        alert('This author does not have a Lightning address set up for zaps');
        return;
      }

      // This would require a real Lightning wallet integration
      // Here we're just showing a confirmation and updating the UI
      const amount = prompt(`Enter amount to zap (in sats, default: ${defaultZapAmount}):`, String(defaultZapAmount));
      
      if (!amount) return;
      
      const sats = parseInt(amount, 10);
      if (isNaN(sats) || sats <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      // In a real app, you would send the zap here
      alert(`Zap of ${sats} sats would be sent to ${post.author.profile.name || post.author.pubkey}`);

      // Update UI optimistically 
      setPosts(currentPosts => {
        return currentPosts.map(p => 
          p.id === post.id 
            ? { ...p, zaps: p.zaps + 1, zapAmount: p.zapAmount + sats } 
            : p
        );
      });

    } catch (error) {
      console.error('Error zapping:', error);
      alert('Failed to send zap. Please try again.');
    }
  };

  const handleSubmitComment = async (postId: string) => {
    if (!commentText.trim()) return;
    
    if (!window.nostr) {
      const result = await login();
      if (!result) return;
    }

    try {
      const commentEvent = {
        kind: 1, // Regular note
        created_at: Math.floor(Date.now() / 1000),
        content: commentText,
        tags: [
          ['e', postId],
          ['p', posts.find(p => p.id === postId)?.author.pubkey || '']
        ]
      };

      const signedEvent = await window.nostr?.signEvent(commentEvent);
      if (!signedEvent) return;

      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      // Get the user's profile
      let userProfile = {};
      try {
        const metadata = await window.nostr?.getMetadata();
        if (metadata) userProfile = metadata;
      } catch (err) {
        console.error('Error getting user profile:', err);
      }

      // Add the comment locally
      const userPubkey = await window.nostr?.getPublicKey();
      if (!userPubkey) return;

      const newComment = {
        id: signedEvent.id,
        content: commentText,
        created_at: Math.floor(Date.now() / 1000),
        author: {
          pubkey: userPubkey,
          profile: userProfile
        }
      };

      setPosts(currentPosts => {
        return currentPosts.map(p => 
          p.id === postId 
            ? { ...p, comments: [...p.comments, newComment] } 
            : p
        );
      });

      setCommentText('');
      setActivePostForComment(null);
      console.log('Comment posted successfully');
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  // Format timestamp to relative time (e.g., "2 hours ago")
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6">Diet & Nutrition Posts</h1>
      
      {loading && page === 1 && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="ml-2">Loading posts...</span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      {posts.length === 0 && !loading && !error && (
        <div className="text-center py-10">
          <p className="text-lg text-gray-500">No posts found. Try following more people or checking your hashtags.</p>
        </div>
      )}
      
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="p-4">
            <div className="flex">
              <Avatar className="h-10 w-10 mr-3">
                {post.author.profile.picture ? (
                  <img src={post.author.profile.picture} alt="Profile" />
                ) : (
                  <div className="bg-primary text-white flex items-center justify-center h-full">
                    {(post.author.profile.name?.[0] || post.author.pubkey.slice(0, 2)).toUpperCase()}
                  </div>
                )}
              </Avatar>
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">
                      {post.author.profile.name || post.author.profile.display_name || post.author.pubkey.slice(0, 8)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatRelativeTime(post.created_at)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-2">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: formatNostrContent(post.content) }}
                  />
                </div>
                
                {post.images && post.images.length > 0 && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {post.images.map((img, idx) => (
                        <a 
                          key={idx} 
                          href={img} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block rounded-md overflow-hidden"
                        >
                          <img 
                            src={img} 
                            alt="Post attachment" 
                            className="w-full h-auto max-h-64 object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center mt-4 space-x-6">
                  <button 
                    className="flex items-center text-gray-500 hover:text-primary"
                    onClick={() => handleCommentClick(post.id)}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    <span>{post.comments.length}</span>
                  </button>
                  
                  <button 
                    className={`flex items-center ${userLikes.has(post.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                    onClick={() => handleLike(post)}
                  >
                    <Heart className="h-4 w-4 mr-1" />
                    <span>{post.likes}</span>
                  </button>
                  
                  <button 
                    className={`flex items-center ${userReposts.has(post.id) ? 'text-green-500' : 'text-gray-500 hover:text-green-500'}`}
                    onClick={() => handleRepost(post)}
                  >
                    <Repeat className="h-4 w-4 mr-1" />
                    <span>{post.reposts}</span>
                  </button>
                  
                  <button 
                    className="flex items-center text-gray-500 hover:text-yellow-500"
                    onClick={() => handleZap(post)}
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    <span>{post.zapAmount > 0 ? `${post.zapAmount} sats` : '0'}</span>
                  </button>
                </div>
                
                {post.showComments && (
                  <div className="mt-4 space-y-4">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="pl-3 border-l-2 border-gray-200">
                        <div className="flex items-start">
                          <Avatar className="h-6 w-6 mr-2">
                            {comment.author.profile.picture ? (
                              <img src={comment.author.profile.picture} alt="Profile" />
                            ) : (
                              <div className="bg-gray-300 text-white flex items-center justify-center h-full text-xs">
                                {(comment.author.profile.name?.[0] || comment.author.pubkey.slice(0, 2)).toUpperCase()}
                              </div>
                            )}
                          </Avatar>
                          <div>
                            <div className="flex items-baseline">
                              <span className="font-medium text-sm">
                                {comment.author.profile.name || comment.author.profile.display_name || comment.author.pubkey.slice(0, 8)}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            <div 
                              className="text-sm mt-1 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: formatNostrContent(comment.content) }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {activePostForComment === post.id ? (
                      <div className="mt-3">
                        <textarea
                          className="w-full p-2 border border-gray-300 rounded-md"
                          rows={2}
                          placeholder="Write a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        />
                        <div className="flex justify-end mt-2 space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setActivePostForComment(null);
                              setCommentText('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleSubmitComment(post.id)}
                          >
                            Post
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setActivePostForComment(post.id)}
                      >
                        Add a comment...
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {loading && page > 1 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Loading more...</span>
        </div>
      )}
      
      {!loading && hasMore && posts.length > 0 && (
        <div className="flex justify-center py-4">
          <Button onClick={loadMorePosts}>Load More</Button>
        </div>
      )}
      
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          No more posts to load
        </div>
      )}
    </div>
  );
};