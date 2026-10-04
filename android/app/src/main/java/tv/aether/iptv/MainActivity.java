package tv.aether.iptv;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Native shell for the Aether 10-foot player.
 *
 * Responsibilities kept deliberately thin — the web layer owns navigation,
 * focus and playback. The shell only supplies what a browser page cannot:
 *  - immersive fullscreen (no status/nav bars on TV or phone)
 *  - screen kept awake while a stream is playing
 *  - WebView playback settings required for hls.js / mpegts.js autoplay and
 *    hardware-accelerated video
 *  - a focusable WebView so D-pad events reach the DOM, and touch-mode focus on
 *    touch devices so tapping a text input raises the soft keyboard (BUG-018)
 *
 * BACK is handled in the web layer via @capacitor/app (see
 * src/shared/input/nativeBackBridge.ts) and is intentionally not intercepted
 * here, so the single BACK funnel keeps owning overlay dispatch (BUG-002).
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Streams must not be interrupted by the display sleeping.
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    applyImmersiveMode();

    WebView webView = getBridge().getWebView();
    if (webView != null) {
      WebSettings settings = webView.getSettings();
      settings.setMediaPlaybackRequiresUserGesture(false);
      settings.setDomStorageEnabled(true);
      settings.setDatabaseEnabled(true);
      // Android TV remotes report directional keys through the WebView; the
      // spatial-navigation layer in the web app consumes them.
      settings.setSupportMultipleWindows(false);

      // A View that is not focusable in touch mode cannot take focus from a
      // tap, so the WebView never connects to the IME and Android never raises
      // the soft keyboard when the user taps a text input. That is correct on
      // TV (no touch, D-pad owns focus) but breaks every text field on phones.
      // The flavor supplies `aether_touch_device` so both form factors behave.
      // Regression: BUG-018, guarded by androidTest/MainActivityImeTest.
      boolean touchDevice = getResources().getBoolean(R.bool.aether_touch_device);
      webView.setFocusable(true);
      webView.setFocusableInTouchMode(touchDevice);
      webView.requestFocus();
    }
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      applyImmersiveMode();
    }
  }

  /**
   * Translates the remote's OK button (KEYCODE_DPAD_CENTER) into KEYCODE_ENTER.
   *
   * The spatial-navigation engine in the web layer activates the focused item on
   * an `Enter` DOM key event. Many TV remotes and D-pads report OK as
   * DPAD_CENTER (23) with no Enter key name, which reaches the DOM as an
   * unidentified key and would silently do nothing. Keys that already arrive as
   * ENTER pass through unchanged, so there is exactly one activation per
   * physical press.
   */
  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    if (event.getKeyCode() == KeyEvent.KEYCODE_DPAD_CENTER) {
      KeyEvent enterEvent = new KeyEvent(
          event.getDownTime(),
          event.getEventTime(),
          event.getAction(),
          KeyEvent.KEYCODE_ENTER,
          event.getRepeatCount(),
          event.getMetaState());
      return super.dispatchKeyEvent(enterEvent);
    }
    return super.dispatchKeyEvent(event);
  }

  private void applyImmersiveMode() {
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    controller.hide(WindowInsetsCompat.Type.systemBars());
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  }
}
