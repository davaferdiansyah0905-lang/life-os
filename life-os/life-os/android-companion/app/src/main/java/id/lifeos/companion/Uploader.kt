package id.lifeos.companion

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Sends parsed-ready notification text to the LifeOS dashboard over HTTPS with a bearer token. */
object Uploader {
    private val executor = Executors.newSingleThreadExecutor()

    data class Result(val ok: Boolean, val code: Int, val body: String)

    fun post(prefs: Prefs, payload: JSONObject): Result {
        if (prefs.serverUrl.isBlank() || prefs.token.isBlank()) return Result(false, 0, "URL/token belum diatur")
        if (!prefs.serverUrl.startsWith("https://")) return Result(false, 0, "URL harus https://")
        return try {
            val conn = URL("${prefs.serverUrl}/api/ingest").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 10_000
            conn.readTimeout = 20_000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer ${prefs.token}")
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            Result(code in 200..299, code, body)
        } catch (e: Exception) {
            Result(false, -1, e.message ?: e.javaClass.simpleName)
        }
    }

    /** Async send with offline queue. 422 = not a transaction → dropped (not retried). */
    fun send(prefs: Prefs, payload: JSONObject, onDone: ((Result) -> Unit)? = null) {
        executor.execute {
            val r = post(prefs, payload)
            when {
                r.ok -> {
                    prefs.sentCount = prefs.sentCount + 1
                    prefs.lastStatus = "Terkirim (${r.code})"
                    // flush anything that failed earlier
                    for (queued in prefs.drainQueue()) {
                        val q = post(prefs, queued)
                        if (!q.ok && q.code <= 0) prefs.enqueue(queued)
                    }
                }
                r.code == 422 -> prefs.lastStatus = "Bukan notifikasi transaksi (diabaikan)"
                r.code == 401 -> prefs.lastStatus = "Token ditolak server (401)"
                else -> {
                    prefs.enqueue(payload)
                    prefs.lastStatus = "Gagal kirim (${r.code}): ${r.body.take(80)} — disimpan di antrean"
                }
            }
            onDone?.invoke(r)
        }
    }
}
