package id.lifeos.companion

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Listens to notifications ONLY after the user grants "Notification access" in system settings.
 * Forwards notifications that look like financial transactions (amount + transaction keyword).
 * It never reads OTP/PIN messages and never interacts with banking apps.
 */
class BankNotificationListener : NotificationListenerService() {

    private val recent = LinkedHashMap<String, Long>()

    override fun onListenerConnected() {
        super.onListenerConnected()
        val prefs = Prefs(this)
        Uploader.send(prefs, JSONObject().put("heartbeat", true))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val prefs = Prefs(this)
        if (sbn.packageName == packageName) return
        if (!prefs.allApps && sbn.packageName !in prefs.packages) return

        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val content = listOf(title, if (big.length > text.length) big else text).filter { it.isNotBlank() }.joinToString(". ")
        if (!looksLikeTransaction(content)) return

        // de-duplicate repeated posts of the same notification within 2 minutes
        val key = "${sbn.packageName}|${content.hashCode()}"
        val now = System.currentTimeMillis()
        synchronized(recent) {
            recent.entries.removeAll { now - it.value > 120_000 }
            if (recent.containsKey(key)) return
            recent[key] = now
        }

        val payload = JSONObject()
            .put("text", content.take(1000))
            .put("app", sbn.packageName)
            .put("postedAt", sbn.postTime)
        Uploader.send(prefs, payload)
    }

    companion object {
        private val AMOUNT = Regex("""(?i)(rp\.?|idr)\s?[\d.,]{3,}""")
        private val KEYWORDS = Regex("""(?i)(qris|pembayaran|bayar|transfer|debit|kredit|dana masuk|uang masuk|diterima|menerima|pembelian|transaksi|tarik tunai|top ?up)""")
        private val SENSITIVE = Regex("""(?i)(\botp\b|kode verifikasi|verification code|\bpin\b|password|kata sandi|jangan berikan)""")

        fun looksLikeTransaction(s: String): Boolean =
            s.isNotBlank() && AMOUNT.containsMatchIn(s) && KEYWORDS.containsMatchIn(s) && !SENSITIVE.containsMatchIn(s)
    }
}
