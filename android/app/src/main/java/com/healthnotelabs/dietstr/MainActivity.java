package com.healthnotelabs.dietstr;

import android.os.Bundle;
import android.view.WindowManager;
import android.graphics.Color;
import android.view.View;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Set navigation bar to match the app's theme for a more integrated look
        getWindow().setNavigationBarColor(Color.parseColor("#000000"));
        
        // For API level 28+ (Android 9+), support proper cutout handling
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = 
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        
        // For API level 27+ (Android 8.1+), support light navigation bar with dark icons
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            getWindow().setNavigationBarColor(Color.WHITE);
            // Set navigation bar button icons to dark
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            );
        }
    }
}
