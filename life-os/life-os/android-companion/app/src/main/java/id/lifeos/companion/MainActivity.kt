package id.lifeos.companion

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject

/** Simple settings screen built in code (no layout XML, no extra libraries). */
class MainActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val pad = (16 * resources.displayMetrics.density).toInt()

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        fun label(t: String, size: Float = 14f) = TextView(this).apply { text = t; textSize = size; setPadding(0, pad / 2, 0, pad / 4) }

        root.addView(label("LifeOS Companion", 22f))
        root.addView(label("Meneruskan notifikasi transaksi (QRIS, transfer, e-wallet) ke dashboard LifeOS. Aplikasi ini TIDAK pernah meminta password, PIN, atau OTP, dan tidak login ke aplikasi bank."))

        root.addView(label("URL dashboard (https://…vercel.app)"))
        val url = EditText(this).apply { setText(prefs.serverUrl); hint = "https://nama-app.vercel.app"; inputType = InputType.TYPE_TEXT_VARIATION_URI }
        root.addView(url, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        root.addView(label("Token integrasi (sama dengan INGEST_TOKEN)"))
        val token = EditText(this).apply { setText(prefs.token); inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        root.addView(token, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        val allApps = CheckBox(this).apply { text = "Pantau semua aplikasi (hanya notifikasi berisi nominal & kata transaksi)"; isChecked = prefs.allApps }
        root.addView(allApps)

        root.addView(label("Daftar paket aplikasi bank/e-wallet (jika opsi di atas dimatikan), pisahkan dengan koma:"))
        val pkgs = EditText(this).apply { setText(prefs.packages.sorted().joinToString(", ")); minLines = 2 }
        root.addView(pkgs, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        root.addView(Button(this).apply {
            text = "Simpan pengaturan"
            setOnClickListener {
                prefs.serverUrl = url.text.toString()
                prefs.token = token.text.toString()
                prefs.allApps = allApps.isChecked
                prefs.packages = pkgs.text.toString().split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
                Toast.makeText(this@MainActivity, "Tersimpan", Toast.LENGTH_SHORT).show()
                refresh()
            }
        })
        root.addView(Button(this).apply {
            text = "Beri izin Akses Notifikasi"
            setOnClickListener { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        })
        root.addView(Button(this).apply {
            text = "Tes koneksi (heartbeat)"
            setOnClickListener {
                Uploader.send(prefs, JSONObject().put("heartbeat", true)) { r ->
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, if (r.ok) "Terhubung ✔" else "Gagal: ${r.code} ${r.body.take(80)}", Toast.LENGTH_LONG).show()
                        refresh()
                    }
                }
            }
        })
        root.addView(Button(this).apply {
            text = "Kirim notifikasi contoh"
            setOnClickListener {
                val p = JSONObject().put("text", "Transaksi QRIS berhasil. Pembayaran Rp25.000 di Warung Makan.").put("app", "id.lifeos.companion.test")
                Uploader.send(prefs, p) { r -> runOnUiThread { Toast.makeText(this@MainActivity, if (r.ok) "Terkirim — cek AI Agent di dashboard" else "Gagal: ${r.code}", Toast.LENGTH_LONG).show(); refresh() } }
            }
        })

        status = label("")
        root.addView(status)
        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
            ?.contains(ComponentName(this, BankNotificationListener::class.java).flattenToString()) == true
        status.text = buildString {
            appendLine("Izin akses notifikasi: ${if (enabled) "AKTIF ✔" else "belum diberikan"}")
            appendLine("Terkirim: ${prefs.sentCount} · Antrean offline: ${prefs.queueSize()}")
            append("Status terakhir: ${prefs.lastStatus}")
        }
    }
}
