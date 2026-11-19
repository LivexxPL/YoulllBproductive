package com.youlllbproductive.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Musi się zgadzać z CHANNEL_LOUD / CHANNEL_NORMAL w src/notifications/native.ts */
    static final String CHANNEL_LOUD = "ybp_alarmy_v1";
    static final String CHANNEL_NORMAL = "ybp_przypomnienia_v1";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    /**
     * Kanały tworzymy natywnie, bo wtyczka JS ustawia dźwięk zawsze w strumieniu
     * powiadomień. Kanał „głośny” gra w strumieniu ALARMU – słychać go nawet,
     * gdy telefon jest wyciszony (głośność budzika).
     * Ustawień dźwięku kanału nie da się zmienić po utworzeniu – stąd sufiks _v1.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        if (nm.getNotificationChannel(CHANNEL_LOUD) == null) {
            NotificationChannel loud = new NotificationChannel(
                CHANNEL_LOUD, "Alarmy (głośne)", NotificationManager.IMPORTANCE_HIGH);
            loud.setDescription("Głośne przypomnienia – dźwięk alarmu, także w trybie cichym");
            Uri sound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/alarm");
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            loud.setSound(sound, attrs);
            loud.enableVibration(true);
            loud.setVibrationPattern(new long[] { 0, 600, 250, 600, 250, 900 });
            loud.enableLights(true);
            loud.setLightColor(Color.parseColor("#4F6BF5"));
            loud.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            loud.setShowBadge(true);
            nm.createNotificationChannel(loud);
        }

        if (nm.getNotificationChannel(CHANNEL_NORMAL) == null) {
            NotificationChannel normal = new NotificationChannel(
                CHANNEL_NORMAL, "Przypomnienia", NotificationManager.IMPORTANCE_HIGH);
            normal.setDescription("Zwykłe powiadomienia z domyślnym dźwiękiem");
            normal.enableVibration(true);
            normal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            normal.setShowBadge(true);
            nm.createNotificationChannel(normal);
        }
    }
}
