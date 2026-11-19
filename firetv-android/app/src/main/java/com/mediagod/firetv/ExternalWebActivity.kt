package com.mediagod.firetv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.FrameLayout

class ExternalWebActivity : Activity() {
    companion object {
        const val EXTRA_URL = "mg_external_url"
    }

    private lateinit var root: FrameLayout
    private lateinit var returnButton: Button
    private lateinit var webView: WebView
    private var customView: View? = null
    private val fullscreenWakeRecovery = FullscreenWakeRecovery({ root }, { customView })
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val target = intent.getStringExtra(EXTRA_URL).orEmpty().trim()
        if (!(target.startsWith("https://") || target.startsWith("http://"))) {
            finish()
            return
        }

        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        enterImmersiveMode()

        root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            isFocusable = true
            isFocusableInTouchMode = true
            setOnLongClickListener { true }

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = false
                builtInZoomControls = false
                displayZoomControls = false
                setSupportZoom(false)
                setSupportMultipleWindows(false)
                javaScriptCanOpenWindowsAutomatically = true
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                userAgentString =
                    "${userAgentString} MediaGodFireTV/1.0 AmazonWebAppPlatform FireTV"
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val next = request?.url ?: return false
                    return handleNonWebUri(next)
                }

                @Suppress("DEPRECATION")
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    url: String?
                ): Boolean {
                    val next = try {
                        Uri.parse(url.orEmpty())
                    } catch (_: Throwable) {
                        return false
                    }
                    return handleNonWebUri(next)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    enterImmersiveMode()
                    if (!returnButton.hasFocus()) view?.requestFocus()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(
                    view: View?,
                    callback: CustomViewCallback?
                ) {
                    val nextView = view ?: run {
                        callback?.onCustomViewHidden()
                        return
                    }

                    if (customView != null) {
                        callback?.onCustomViewHidden()
                        return
                    }

                    customView = nextView
                    customViewCallback = callback
                    visibility = View.GONE
                    root.addView(
                        nextView,
                        FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                    nextView.requestFocus()
                    enterImmersiveMode()
                }

                override fun onHideCustomView() {
                    hideCustomView()
                }
            }
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        returnButton = Button(this).apply {
            text = "Back to Media God"
            isAllCaps = false
            isFocusableInTouchMode = true
            setOnClickListener { finish() }
        }
        root.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(returnButton, ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        })
        setContentView(root)

        if (savedInstanceState == null) {
            webView.loadUrl(target)
        } else {
            webView.restoreState(savedInstanceState)
        }

        webView.requestFocus()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onResume() {
        super.onResume()
        enterImmersiveMode()
        webView.onResume()
        webView.resumeTimers()
        fullscreenWakeRecovery.onResume()
    }

    override fun onPause() {
        fullscreenWakeRecovery.onPause()
        webView.onPause()
        webView.pauseTimers()
        super.onPause()
    }

    override fun onDestroy() {
        hideCustomView()

        if (::webView.isInitialized) {
            try {
                webView.apply {
                    loadUrl("about:blank")
                    stopLoading()
                    clearHistory()
                    destroy()
                }
            } catch (_: Throwable) {
                // Best-effort WebView teardown.
            }
        }

        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        fullscreenWakeRecovery.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enterImmersiveMode()
        }
    }

    // Intercept at the activity boundary, before a provider or its fullscreen
    // view can consume Back. Finish on release so Main never receives that key.
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        when (event.keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> {
                if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) finish()
                return true
            }
            KeyEvent.KEYCODE_MENU -> {
                if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
                    if (customView != null) hideCustomView()
                    returnButton.requestFocus()
                }
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Retained for system Back on older Android TV devices")
    override fun onBackPressed() {
        finish()
    }

    private fun handleNonWebUri(uri: Uri): Boolean {
        val scheme = uri.scheme.orEmpty().lowercase()
        if (scheme == "http" || scheme == "https") {
            return false
        }

        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: Throwable) {
            true
        }
    }

    private fun hideCustomView() {
        fullscreenWakeRecovery.clear()
        val activeCustomView = customView ?: return
        customView = null

        try {
            root.removeView(activeCustomView)
        } catch (_: Throwable) {
            // Ignore stale custom-view removal.
        }

        customViewCallback?.onCustomViewHidden()
        customViewCallback = null

        if (::webView.isInitialized) {
            webView.visibility = View.VISIBLE
            webView.requestFocus()
        }

        enterImmersiveMode()
    }

    private fun enterImmersiveMode() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
}