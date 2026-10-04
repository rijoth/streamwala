package tv.streamwala.iptv;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import android.view.WindowManager;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Device-level regression guard for BUG-018: the soft keyboard (IME) must open
 * when a user taps a text input on a touch device.
 *
 * jsdom cannot observe IME behaviour and Capacitor's WebView focus is a native
 * concern, so this is an instrumented test. Run per flavor on a connected
 * device/emulator:
 *
 *   bash scripts/android-gradle.sh connectedMobileDebugAndroidTest
 *   bash scripts/android-gradle.sh connectedTvDebugAndroidTest
 */
@RunWith(AndroidJUnit4.class)
public class MainActivityImeTest {

  /**
   * A WebView that is not focusable in touch mode never takes focus from a tap,
   * so the IME is never told to open. The mobile flavor must enable touch-mode
   * focus; the TV flavor must keep it off for deterministic D-pad focus.
   */
  @Test
  public void webViewTouchFocusMatchesFormFactor() {
    try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
      scenario.onActivity(activity -> {
        WebView webView = activity.getBridge().getWebView();
        assertNotNull("WebView is expected to exist", webView);
        boolean touchDevice = activity.getResources().getBoolean(R.bool.streamwala_touch_device);
        assertEquals(
            "WebView focusableInTouchMode must match the form factor (BUG-018)",
            touchDevice,
            webView.isFocusableInTouchMode());
      });
    }
  }

  /**
   * The activity must declare adjustResize so the WebView is resized above the
   * keyboard, otherwise the focused field stays hidden behind the IME.
   */
  @Test
  public void windowAllowsImeResize() {
    try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
      scenario.onActivity(activity -> {
        int adjust =
            activity.getWindow().getAttributes().softInputMode
                & WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST;
        assertEquals(
            "Activity must use SOFT_INPUT_ADJUST_RESIZE for the IME (BUG-018)",
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
            adjust);
      });
    }
  }
}
