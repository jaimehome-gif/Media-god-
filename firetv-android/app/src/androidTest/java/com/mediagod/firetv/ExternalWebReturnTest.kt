package com.mediagod.firetv

import android.content.Context
import android.content.Intent
import android.view.KeyEvent
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ExternalWebReturnTest {
    private fun launch(): ActivityScenario<ExternalWebActivity> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        return ActivityScenario.launch(Intent(context, ExternalWebActivity::class.java)
            .putExtra(ExternalWebActivity.EXTRA_URL, "https://example.invalid/"))
    }

    @Test fun providerCannotSwallowRemoteBack() {
        launch().use { scenario ->
            scenario.onActivity { activity ->
                val content = activity.findViewById<FrameLayout>(android.R.id.content)
                val layout = (content.getChildAt(0) as FrameLayout).getChildAt(0) as LinearLayout
                val web = layout.getChildAt(1) as WebView
                web.requestFocus()
                web.setOnKeyListener { _, _, _ -> true }
                activity.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK))
                assertFalse(activity.isFinishing)
                activity.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK))
                assertTrue(activity.isFinishing)
            }
        }
    }

    @Test fun menuSelectsNativeReturnButton() {
        launch().use { scenario ->
            scenario.onActivity { activity ->
                activity.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MENU))
                activity.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MENU))
                val button = activity.currentFocus as Button
                assertEquals("Back to Media God", button.text.toString())
                button.performClick()
                assertTrue(activity.isFinishing)
            }
        }
    }
}
