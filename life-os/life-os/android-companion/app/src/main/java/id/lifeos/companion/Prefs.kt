package id.lifeos.companion

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Small wrapper around SharedPreferences (server URL, token, filters, offline queue). */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("lifeos", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("serverUrl", "") ?: ""
        set(v) = sp.edit().putString("serverUrl", v.trim().trimEnd('/')).apply()

    var token: String
        get() = sp.getString("token", "") ?: ""
        set(v) = sp.edit().putString("token", v.trim()).apply()

    /** true = listen to every app but only forward notifications that look like transactions. */
    var allApps: Boolean
        get() = sp.getBoolean("allApps", true)
        set(v) = sp.edit().putBoolean("allApps", v).apply()

    var packages: Set<String>
        get() = sp.getStringSet("packages", DEFAULT_PACKAGES) ?: DEFAULT_PACKAGES
        set(v) = sp.edit().putStringSet("packages", v).apply()

    var sentCount: Int
        get() = sp.getInt("sent", 0)
        set(v) = sp.edit().putInt("sent", v).apply()

    var lastStatus: String
        get() = sp.getString("lastStatus", "Belum ada aktivitas") ?: ""
        set(v) = sp.edit().putString("lastStatus", v).apply()

    // ── offline queue (only the minimal payload; flushed on the next successful send) ──
    @Synchronized
    fun enqueue(payload: JSONObject) {
        val arr = JSONArray(sp.getString("queue", "[]"))
        arr.put(payload)
        // keep the queue small
        val trimmed = JSONArray()
        val start = maxOf(0, arr.length() - 50)
        for (i in start until arr.length()) trimmed.put(arr.get(i))
        sp.edit().putString("queue", trimmed.toString()).apply()
    }

    @Synchronized
    fun drainQueue(): List<JSONObject> {
        val arr = JSONArray(sp.getString("queue", "[]"))
        sp.edit().putString("queue", "[]").apply()
        return (0 until arr.length()).map { arr.getJSONObject(it) }
    }

    fun queueSize(): Int = JSONArray(sp.getString("queue", "[]")).length()

    companion object {
        /** Common Indonesian banking / e-wallet apps. Package names can change — edit in the app if needed. */
        val DEFAULT_PACKAGES = setOf(
            "com.bca", "com.bca.mybca.omni.android", "id.bmri.livin", "id.co.bri.brimo",
            "id.bni.wondr", "src.com.bni", "com.jago.digitalBanking", "id.co.bankbkemobile.digitalbank",
            "com.gojek.app", "ovo.id", "id.dana", "com.shopee.id"
        )
    }
}
