export default function IslamicBlessing() {
  return (
    <section className="bg-cream/60 px-5 py-14 text-center">
      <div className="mx-auto max-w-2xl">
        <p className="font-serif text-2xl italic leading-relaxed text-brown sm:text-3xl">
          &ldquo;May Allah bless this union with love, mercy and tranquillity,
          and may Murshida and Shakir&rsquo;s forever be filled with barakah.&rdquo;
        </p>
        <p className="mt-4 text-xs tracking-widest text-brown-light">
          A GENERAL BLESSING — NOT PRESENTED AS A QURAN VERSE OR HADITH.
        </p>
        {/*
          Note for maintainers: do not attribute a generic blessing to a
          specific Quran verse or Hadith unless you have verified the exact
          wording and reference. If a verified verse is added later, cite
          its surah and ayah here.
        */}
      </div>
    </section>
  )
}
