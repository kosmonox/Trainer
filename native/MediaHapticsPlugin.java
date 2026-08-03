package com.apneatrainer.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Vibrates using the MEDIA usage category instead of the default (unattributed)
// category. On Android 12+ this is governed by the "Media" vibration intensity
// slider rather than "Touch feedback" - matching how games/media apps vibrate
// independently of a user's touch-feedback preference.
@CapacitorPlugin(name = "MediaHaptics")
public class MediaHapticsPlugin extends Plugin {

    @PluginMethod
    public void vibrate(PluginCall call) {
        int duration = call.getInt("duration", 50);
        Context context = getContext();

        Vibrator vibrator;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vibratorManager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = vibratorManager.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            VibrationEffect effect = VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibrationAttributes attributes = new VibrationAttributes.Builder()
                    .setUsage(VibrationAttributes.USAGE_MEDIA)
                    .build();
                vibrator.vibrate(effect, attributes);
            } else {
                vibrator.vibrate(effect);
            }
        } else {
            vibrator.vibrate(duration);
        }

        call.resolve();
    }
}
