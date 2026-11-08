// 110 motivational quotes (Indonesian renderings) with author & category.
// Daily rotation uses a fixed permutation so no quote repeats until the whole pool has been shown.

import { dayNumber } from "./time";

export interface Quote {
  text: string;
  author: string;
  category: string;
}

export const QUOTES: Quote[] = [
  // ── Disiplin ──
  { text: "Disiplin adalah jembatan antara tujuan dan pencapaian.", author: "Jim Rohn", category: "Disiplin" },
  { text: "Kita semua harus menanggung salah satu dari dua rasa sakit: sakitnya disiplin, atau sakitnya penyesalan.", author: "Jim Rohn", category: "Disiplin" },
  { text: "Dengan disiplin diri, hampir segala hal menjadi mungkin.", author: "Theodore Roosevelt", category: "Disiplin" },
  { text: "Tidak ada orang yang benar-benar bebas bila ia belum mampu menguasai dirinya sendiri.", author: "Epictetus", category: "Disiplin" },
  { text: "Kita adalah apa yang kita lakukan berulang-ulang. Keunggulan bukanlah sebuah tindakan, melainkan kebiasaan.", author: "Will Durant", category: "Disiplin" },
  { text: "Motivasi membuatmu memulai. Kebiasaan membuatmu terus melangkah.", author: "Jim Ryun", category: "Disiplin" },
  { text: "Jangan menghitung hari. Buatlah hari-harimu berarti.", author: "Muhammad Ali", category: "Disiplin" },
  { text: "Kesabaran, ketekunan, dan keringat adalah kombinasi tak terkalahkan menuju sukses.", author: "Napoleon Hill", category: "Disiplin" },
  { text: "Satu-satunya disiplin yang bertahan lama adalah disiplin diri.", author: "Bum Phillips", category: "Disiplin" },
  { text: "Lakukan apa yang harus kamu lakukan sampai kamu bisa melakukan apa yang ingin kamu lakukan.", author: "Oprah Winfrey", category: "Disiplin" },
  { text: "Orang sukses melakukan apa yang tidak ingin dilakukan orang gagal. Jangan berharap hidup lebih mudah; berharaplah dirimu lebih baik.", author: "Jim Rohn", category: "Disiplin" },

  // ── Mimpi & Ambisi ──
  { text: "Gantungkan cita-citamu setinggi langit! Bermimpilah setinggi langit. Jika engkau jatuh, engkau akan jatuh di antara bintang-bintang.", author: "Soekarno", category: "Mimpi & Ambisi" },
  { text: "Masa depan milik mereka yang percaya pada indahnya mimpi-mimpi mereka.", author: "Eleanor Roosevelt", category: "Mimpi & Ambisi" },
  { text: "Semua mimpi kita bisa menjadi kenyataan jika kita punya keberanian untuk mengejarnya.", author: "Walt Disney", category: "Mimpi & Ambisi" },
  { text: "Kamu tidak pernah terlalu tua untuk menetapkan tujuan baru atau memimpikan mimpi baru.", author: "Les Brown", category: "Mimpi & Ambisi" },
  { text: "Bidiklah bulan. Bahkan jika meleset, kamu akan mendarat di antara bintang-bintang.", author: "Les Brown", category: "Mimpi & Ambisi" },
  { text: "Mimpi bukanlah apa yang kamu lihat saat tidur; mimpi adalah sesuatu yang tidak membiarkanmu tidur.", author: "A.P.J. Abdul Kalam", category: "Mimpi & Ambisi" },
  { text: "Cara terbaik untuk memprediksi masa depan adalah dengan menciptakannya.", author: "Peter Drucker", category: "Mimpi & Ambisi" },
  { text: "Beri aku seribu orang tua, niscaya akan kucabut Semeru dari akarnya. Beri aku sepuluh pemuda, niscaya akan kuguncangkan dunia.", author: "Soekarno", category: "Mimpi & Ambisi" },
  { text: "Tujuan adalah mimpi yang diberi tenggat waktu.", author: "Napoleon Hill", category: "Mimpi & Ambisi" },
  { text: "Jika kamu bisa memimpikannya, kamu bisa mewujudkannya.", author: "William Arthur Ward", category: "Mimpi & Ambisi" },
  { text: "Idealisme adalah kemewahan terakhir yang hanya dimiliki oleh pemuda.", author: "Tan Malaka", category: "Mimpi & Ambisi" },

  // ── Perjuangan & Ketekunan ──
  { text: "Selalu terlihat mustahil sampai semuanya selesai dikerjakan.", author: "Nelson Mandela", category: "Perjuangan & Ketekunan" },
  { text: "Kemuliaan terbesar kita bukan karena tidak pernah jatuh, melainkan karena bangkit setiap kali kita jatuh.", author: "Oliver Goldsmith", category: "Perjuangan & Ketekunan" },
  { text: "Tidak masalah seberapa lambat kamu berjalan, selama kamu tidak berhenti.", author: "Konfusius", category: "Perjuangan & Ketekunan" },
  { text: "Sukses bukanlah akhir, kegagalan tidaklah fatal: keberanian untuk terus melangkahlah yang penting.", author: "Winston Churchill", category: "Perjuangan & Ketekunan" },
  { text: "Saya tidak gagal. Saya hanya menemukan 10.000 cara yang tidak berhasil.", author: "Thomas A. Edison", category: "Perjuangan & Ketekunan" },
  { text: "Kebanyakan kegagalan dalam hidup dialami oleh orang yang tidak menyadari betapa dekatnya mereka dengan keberhasilan saat mereka menyerah.", author: "Thomas A. Edison", category: "Perjuangan & Ketekunan" },
  { text: "Habis gelap terbitlah terang.", author: "R.A. Kartini", category: "Perjuangan & Ketekunan" },
  { text: "Jika kamu sedang melewati neraka, teruslah berjalan.", author: "Winston Churchill", category: "Perjuangan & Ketekunan" },
  { text: "Sungai menembus batu bukan karena kekuatannya, melainkan karena kegigihannya.", author: "Jim Watkins", category: "Perjuangan & Ketekunan" },
  { text: "Kesulitan sering kali mempersiapkan orang biasa untuk takdir yang luar biasa.", author: "C.S. Lewis", category: "Perjuangan & Ketekunan" },
  { text: "Bukan karena aku sangat pintar; hanya saja aku bertahan lebih lama dengan masalah.", author: "Albert Einstein", category: "Perjuangan & Ketekunan" },

  // ── Kepemimpinan ──
  { text: "Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani — di depan memberi teladan, di tengah membangun semangat, di belakang memberi dorongan.", author: "Ki Hajar Dewantara", category: "Kepemimpinan" },
  { text: "Pemimpin adalah orang yang tahu jalannya, menempuh jalannya, dan menunjukkan jalannya.", author: "John C. Maxwell", category: "Kepemimpinan" },
  { text: "Jika tindakanmu menginspirasi orang lain untuk bermimpi lebih, belajar lebih, berbuat lebih, dan menjadi lebih, kamu adalah seorang pemimpin.", author: "John Quincy Adams", category: "Kepemimpinan" },
  { text: "Kepemimpinan adalah kemampuan menerjemahkan visi menjadi kenyataan.", author: "Warren Bennis", category: "Kepemimpinan" },
  { text: "Manajemen adalah melakukan sesuatu dengan benar; kepemimpinan adalah melakukan hal yang benar.", author: "Peter Drucker", category: "Kepemimpinan" },
  { text: "Pemimpin hebat tidak menciptakan pengikut, mereka menciptakan lebih banyak pemimpin.", author: "Tom Peters", category: "Kepemimpinan" },
  { text: "Seorang pemimpin adalah penjual harapan.", author: "Napoleon Bonaparte", category: "Kepemimpinan" },
  { text: "Sebelum menjadi pemimpin, kesuksesan adalah tentang menumbuhkan dirimu. Setelah menjadi pemimpin, kesuksesan adalah tentang menumbuhkan orang lain.", author: "Jack Welch", category: "Kepemimpinan" },
  { text: "Pemimpin terbaik adalah dia yang keberadaannya nyaris tak dirasakan; ketika pekerjaannya selesai, orang-orang berkata: kami melakukannya sendiri.", author: "Lao Tzu", category: "Kepemimpinan" },
  { text: "Kepemimpinan dan belajar adalah dua hal yang tidak dapat dipisahkan.", author: "John F. Kennedy", category: "Kepemimpinan" },
  { text: "Leiden is lijden — memimpin adalah menderita.", author: "Haji Agus Salim", category: "Kepemimpinan" },

  // ── Kesuksesan ──
  { text: "Sukses adalah jumlah dari usaha-usaha kecil yang diulang hari demi hari.", author: "Robert Collier", category: "Kesuksesan" },
  { text: "Satu-satunya tempat di mana sukses datang sebelum kerja adalah di kamus.", author: "Vidal Sassoon", category: "Kesuksesan" },
  { text: "Peluang tidak terjadi begitu saja. Kamu yang menciptakannya.", author: "Chris Grosser", category: "Kesuksesan" },
  { text: "Berusahalah bukan untuk menjadi sukses, tetapi untuk menjadi bernilai.", author: "Albert Einstein", category: "Kesuksesan" },
  { text: "Sukses biasanya datang kepada mereka yang terlalu sibuk untuk mencarinya.", author: "Henry David Thoreau", category: "Kesuksesan" },
  { text: "Cara untuk memulai adalah berhenti bicara dan mulai melakukan.", author: "Walt Disney", category: "Kesuksesan" },
  { text: "Kualitas bukanlah sebuah tindakan, melainkan kebiasaan.", author: "Aristoteles", category: "Kesuksesan" },
  { text: "Sukses adalah berjalan dari kegagalan ke kegagalan tanpa kehilangan antusiasme.", author: "Winston Churchill", category: "Kesuksesan" },
  { text: "Saya menemukan bahwa semakin keras saya bekerja, semakin beruntung saya.", author: "Thomas Jefferson", category: "Kesuksesan" },
  { text: "Jangan takut melepaskan yang baik untuk mengejar yang hebat.", author: "John D. Rockefeller", category: "Kesuksesan" },
  { text: "Kerja keras mengalahkan bakat ketika bakat tidak bekerja keras.", author: "Tim Notke", category: "Kesuksesan" },

  // ── Pengembangan Diri ──
  { text: "Jadilah perubahan yang ingin kamu lihat di dunia.", author: "Mahatma Gandhi", category: "Pengembangan Diri" },
  { text: "Hidup bukanlah tentang menemukan dirimu. Hidup adalah tentang menciptakan dirimu.", author: "George Bernard Shaw", category: "Pengembangan Diri" },
  { text: "Siapa pun yang berhenti belajar sudah tua, entah di usia dua puluh atau delapan puluh.", author: "Henry Ford", category: "Pengembangan Diri" },
  { text: "Kenali dirimu sendiri.", author: "Socrates", category: "Pengembangan Diri" },
  { text: "Hidup yang tidak pernah direnungkan adalah hidup yang tidak layak dijalani.", author: "Socrates", category: "Pengembangan Diri" },
  { text: "Apa yang ada di belakang kita dan apa yang ada di depan kita hanyalah hal kecil dibandingkan dengan apa yang ada di dalam diri kita.", author: "Ralph Waldo Emerson", category: "Pengembangan Diri" },
  { text: "Kita tidak bisa menjadi apa yang kita inginkan dengan tetap menjadi diri kita yang sekarang.", author: "Max De Pree", category: "Pengembangan Diri" },
  { text: "Pikiran adalah segalanya. Apa yang kamu pikirkan, itulah dirimu kelak.", author: "Buddha (dikaitkan)", category: "Pengembangan Diri" },
  { text: "Kamu memiliki kuasa atas pikiranmu, bukan atas peristiwa di luar. Sadari ini, dan kamu akan menemukan kekuatan.", author: "Marcus Aurelius", category: "Pengembangan Diri" },
  { text: "Pertumbuhan dimulai ketika kita mulai menerima kelemahan kita sendiri.", author: "Jean Vanier", category: "Pengembangan Diri" },
  { text: "Satu-satunya orang yang harus kamu kalahkan adalah dirimu yang kemarin.", author: "Pepatah", category: "Pengembangan Diri" },

  // ── Pendidikan ──
  { text: "Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia.", author: "Nelson Mandela", category: "Pendidikan" },
  { text: "Setiap orang menjadi guru, setiap rumah menjadi sekolah.", author: "Ki Hajar Dewantara", category: "Pendidikan" },
  { text: "Aku rela dipenjara asalkan bersama buku, karena dengan buku aku bebas.", author: "Mohammad Hatta", category: "Pendidikan" },
  { text: "Investasi dalam pengetahuan memberikan bunga terbaik.", author: "Benjamin Franklin", category: "Pendidikan" },
  { text: "Hiduplah seolah-olah kamu akan mati besok. Belajarlah seolah-olah kamu akan hidup selamanya.", author: "Mahatma Gandhi", category: "Pendidikan" },
  { text: "Akar pendidikan itu pahit, tetapi buahnya manis.", author: "Aristoteles", category: "Pendidikan" },
  { text: "Pendidikan bukanlah mengisi ember, melainkan menyalakan api.", author: "William Butler Yeats (dikaitkan)", category: "Pendidikan" },
  { text: "Semakin banyak kamu membaca, semakin banyak hal yang kamu ketahui. Semakin banyak kamu belajar, semakin banyak tempat yang akan kamu kunjungi.", author: "Dr. Seuss", category: "Pendidikan" },
  { text: "Belajar tanpa berpikir itu sia-sia; berpikir tanpa belajar itu berbahaya.", author: "Konfusius", category: "Pendidikan" },
  { text: "Hal yang indah dari belajar adalah tidak ada seorang pun yang bisa mengambilnya darimu.", author: "B.B. King", category: "Pendidikan" },
  { text: "Pendidikan adalah paspor menuju masa depan, karena hari esok adalah milik mereka yang mempersiapkannya hari ini.", author: "Malcolm X", category: "Pendidikan" },

  // ── Karier ──
  { text: "Satu-satunya cara untuk melakukan pekerjaan hebat adalah dengan mencintai apa yang kamu kerjakan.", author: "Steve Jobs", category: "Karier" },
  { text: "Pilihlah pekerjaan yang kamu cintai, dan kamu tidak perlu bekerja sehari pun dalam hidupmu.", author: "Konfusius (dikaitkan)", category: "Karier" },
  { text: "Jadilah begitu baik sehingga mereka tidak bisa mengabaikanmu.", author: "Steve Martin", category: "Karier" },
  { text: "Kesempatan sering kali menyamar sebagai kerja keras, sehingga kebanyakan orang tidak mengenalinya.", author: "Ann Landers", category: "Karier" },
  { text: "Butuh dua puluh tahun untuk membangun reputasi dan lima menit untuk menghancurkannya.", author: "Warren Buffett", category: "Karier" },
  { text: "Jika seseorang menawarimu kesempatan luar biasa tetapi kamu belum yakin bisa, katakan ya — lalu pelajari caranya kemudian.", author: "Richard Branson", category: "Karier" },
  { text: "Waktumu terbatas, jadi jangan sia-siakan dengan menjalani hidup orang lain.", author: "Steve Jobs", category: "Karier" },
  { text: "Bergeraklah cepat. Kecuali kamu memecahkan sesuatu, kamu tidak bergerak cukup cepat.", author: "Mark Zuckerberg", category: "Karier" },
  { text: "Keahlian adalah hasil dari ribuan jam latihan yang disengaja.", author: "Anders Ericsson (disarikan)", category: "Karier" },
  { text: "Jangan pernah berhenti belajar, karena hidup tidak pernah berhenti mengajar.", author: "Pepatah", category: "Karier" },
  { text: "Bekerja keraslah dalam diam, biarkan kesuksesanmu yang bersuara.", author: "Frank Ocean (dikaitkan)", category: "Karier" },

  // ── Manajemen Waktu ──
  { text: "Waktu adalah apa yang paling kita inginkan, tetapi paling buruk kita gunakan.", author: "William Penn", category: "Manajemen Waktu" },
  { text: "Apakah kamu mencintai hidup? Maka jangan sia-siakan waktu, karena dari waktulah hidup itu tersusun.", author: "Benjamin Franklin", category: "Manajemen Waktu" },
  { text: "Kunci bukanlah memprioritaskan apa yang ada di jadwalmu, melainkan menjadwalkan prioritasmu.", author: "Stephen R. Covey", category: "Manajemen Waktu" },
  { text: "Hal yang penting jarang mendesak, dan hal yang mendesak jarang penting.", author: "Dwight D. Eisenhower", category: "Manajemen Waktu" },
  { text: "Waktu yang hilang tidak pernah ditemukan lagi.", author: "Benjamin Franklin", category: "Manajemen Waktu" },
  { text: "Bukan karena hidup ini singkat, tetapi kita menyia-nyiakan banyak darinya.", author: "Seneca", category: "Manajemen Waktu" },
  { text: "Perencanaan adalah membawa masa depan ke masa kini agar kamu bisa melakukan sesuatu tentangnya sekarang.", author: "Alan Lakein", category: "Manajemen Waktu" },
  { text: "Jika kamu ingin sesuatu selesai, berikan kepada orang yang sibuk.", author: "Benjamin Franklin (dikaitkan)", category: "Manajemen Waktu" },
  { text: "Kamu akan menemukan waktu luang jika kamu tidak membuang-buangnya.", author: "Pepatah", category: "Manajemen Waktu" },
  { text: "Hari ini adalah hasil dari kemarin; esok adalah hasil dari hari ini.", author: "Pepatah", category: "Manajemen Waktu" },
  { text: "Waktu adalah pedang; jika kamu tidak menggunakannya dengan baik, ia akan memotongmu.", author: "Pepatah Arab", category: "Manajemen Waktu" },

  // ── Konsistensi ──
  { text: "Sedikit demi sedikit, lama-lama menjadi bukit.", author: "Peribahasa Indonesia", category: "Konsistensi" },
  { text: "Tetesan air melubangi batu, bukan karena kekuatannya, melainkan karena terus-menerus menetes.", author: "Ovid", category: "Konsistensi" },
  { text: "Kesuksesan tidak selalu tentang kehebatan. Ini tentang konsistensi. Kerja keras yang konsisten menghasilkan kesuksesan.", author: "Dwayne Johnson", category: "Konsistensi" },
  { text: "Perjalanan seribu mil dimulai dengan satu langkah.", author: "Lao Tzu", category: "Konsistensi" },
  { text: "Hal-hal kecil yang dilakukan secara konsisten menciptakan hasil yang besar.", author: "Darren Hardy", category: "Konsistensi" },
  { text: "Kebiasaan adalah bunga majemuk dari pengembangan diri.", author: "James Clear", category: "Konsistensi" },
  { text: "Kamu tidak naik ke level tujuanmu; kamu jatuh ke level sistemmu.", author: "James Clear", category: "Konsistensi" },
  { text: "Bukan apa yang kita lakukan sesekali yang membentuk hidup kita, melainkan apa yang kita lakukan secara konsisten.", author: "Tony Robbins", category: "Konsistensi" },
  { text: "Berakit-rakit ke hulu, berenang-renang ke tepian. Bersakit-sakit dahulu, bersenang-senang kemudian.", author: "Peribahasa Indonesia", category: "Konsistensi" },
  { text: "Juara tidak menjadi juara di atas ring; mereka hanya diakui di sana.", author: "Joe Frazier", category: "Konsistensi" },
  { text: "Teruslah melangkah. Kemajuan kecil tetaplah kemajuan.", author: "Pepatah", category: "Konsistensi" },
];

/** Deterministic pseudo-random permutation (mulberry32 + Fisher–Yates). */
function permutation(n: number, seed = 20241109) {
  let a = seed;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const PERM = permutation(QUOTES.length);

/** Indices of the pool allowed by the user's category preferences, in rotation order. */
export function quotePool(categories?: string[]) {
  const allowed = categories && categories.length ? new Set(categories) : null;
  const pool = PERM.filter((i) => !allowed || allowed.has(QUOTES[i].category));
  return pool.length ? pool : PERM;
}

/** Quote index for a given date: changes daily, no repeats until the pool is exhausted. */
export function dailyQuoteIndex(dateKey: string, categories?: string[]) {
  const pool = quotePool(categories);
  const n = dayNumber(dateKey);
  return pool[((n % pool.length) + pool.length) % pool.length];
}
