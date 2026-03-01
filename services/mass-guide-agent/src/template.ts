/**
 * HTML template for the Order of Mass pamphlet.
 * Designed for landscape printing, 2-column grid, front-and-back on one sheet.
 */

export interface MassPropers {
  /** ISO date string yyyy-mm-dd */
  date: string;
  /** e.g. "Second Sunday of Lent" */
  designation: string;
  /** Lectionary cycle: "A" | "B" | "C" */
  cycle: string;
  /** e.g. "Purple", "Green", "White", "Red" */
  color: string;
  /** e.g. "Lent", "Ordinary Time", "Easter", "Advent", "Christmas" */
  season: string;
  firstReading: { citation: string; text: string };
  responsorialPsalm: { citation: string; refrain: string };
  secondReading: { citation: string; text: string };
  gospelAcclamation: { verse: string };
  gospel: { citation: string; text: string };
  /** Brief thematic summary for the footer */
  theme: string;
}

function formatDateDisplay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function renderPamphlet(p: MassPropers): string {
  const displayDate = formatDateDisplay(p.date);
  const isLent = p.season === "Lent";
  const isAdvent = p.season === "Advent";
  const skipGloria = isLent || isAdvent;
  const gloriaNote = skipGloria
    ? `<p class="rubric">Gloria is omitted during ${p.season}.</p>`
    : `<h3>Gloria</h3>
    <div class="prayer">
      Glory to God in the highest, and on earth peace to people of good will.
      We praise you, we bless you, we adore you, we glorify you,
      we give you thanks for your great glory,
      Lord God, heavenly King, O God, almighty Father.
      Lord Jesus Christ, Only Begotten Son, Lord God, Lamb of God, Son of the Father,
      you take away the sins of the world, have mercy on us;
      you take away the sins of the world, receive our prayer;
      you are seated at the right hand of the Father, have mercy on us.
      For you alone are the Holy One, you alone are the Lord,
      you alone are the Most High, Jesus Christ,
      with the Holy Spirit, in the glory of God the Father. Amen.
    </div>`;

  const acclamationText = isLent
    ? `<div class="refrain">Praise to you, Lord Jesus Christ, King of endless glory!</div>`
    : `<div class="refrain">Alleluia, alleluia!</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Order of Mass — ${p.designation} — ${displayDate}</title>
<style>
  @page {
    size: 11in 8.5in;
    margin: 0.3in 0.4in;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.2pt;
    line-height: 1.28;
    color: #1a1a1a;
  }
  .page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 0.4in;
    height: 7.9in;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  .col { overflow: hidden; }
  .header {
    grid-column: 1 / -1;
    text-align: center;
    border-bottom: 2px solid #4a0e4e;
    padding-bottom: 2pt;
    margin-bottom: 4pt;
  }
  .header h1 { font-size: 16.8pt; color: #4a0e4e; margin-bottom: 1pt; }
  .header .sub { font-size: 10.5pt; color: #666; font-style: italic; }
  h2 {
    font-size: 11.9pt; color: #4a0e4e; margin-top: 5pt; margin-bottom: 2pt;
    border-bottom: 1px solid #ccc; padding-bottom: 1pt;
    text-transform: uppercase; letter-spacing: 0.4pt;
  }
  h2:first-child { margin-top: 0; }
  h3 { font-size: 11.2pt; margin-top: 4pt; margin-bottom: 1pt; color: #333; }
  .dialogue { margin: 1pt 0 1pt 6pt; }
  .v { font-style: italic; }
  .r { font-weight: bold; }
  .prayer { font-weight: bold; margin: 1pt 0 1pt 6pt; line-height: 1.25; }
  .reading { margin: 1pt 0 1pt 4pt; font-style: italic; font-size: 10.5pt; line-height: 1.25; }
  .rubric { font-size: 9.8pt; color: #888; font-style: italic; margin: 1pt 0; }
  .refrain { font-weight: bold; text-align: center; margin: 1pt 0; }
</style>
</head>
<body>

<!-- SIDE 1 (Front) -->
<div class="page">
  <div class="header">
    <h1>Order of Mass</h1>
    <div class="sub">${p.designation} &bull; ${displayDate} &bull; Year ${p.cycle} &bull; ${p.color}</div>
  </div>

  <div class="col">
    <h2>I. Introductory Rites</h2>
    <h3>Sign of the Cross &amp; Greeting</h3>
    <div class="dialogue">
      <span class="v">P:</span> In the name of the Father, and of the Son, and of the Holy Spirit. <span class="r">Amen.</span>
    </div>
    <div class="dialogue">
      <span class="v">P:</span> The grace of our Lord Jesus Christ, and the love of God, and the communion of the Holy Spirit be with you all.<br>
      <span class="r">And with your spirit.</span>
    </div>
    <h3>Penitential Act</h3>
    <div class="prayer">
      I confess to almighty God and to you, my brothers and sisters,
      that I have greatly sinned, in my thoughts and in my words,
      in what I have done and in what I have failed to do,
      <span class="rubric">(strike breast three times)</span>
      through my fault, through my fault, through my most grievous fault;
      therefore I ask blessed Mary ever-Virgin, all the Angels and Saints,
      and you, my brothers and sisters, to pray for me to the Lord our God.
    </div>
    <h3>Kyrie</h3>
    <div class="dialogue">
      Lord, have mercy. <span class="r">Lord, have mercy.</span><br>
      Christ, have mercy. <span class="r">Christ, have mercy.</span><br>
      Lord, have mercy. <span class="r">Lord, have mercy.</span>
    </div>
    ${gloriaNote}

    <h2>II. Liturgy of the Word</h2>
    <h3>First Reading — ${p.firstReading.citation}</h3>
    <div class="reading">${p.firstReading.text}</div>
    <div class="dialogue"><span class="v">Lector:</span> The Word of the Lord. <span class="r">Thanks be to God.</span></div>
    <h3>Responsorial Psalm — ${p.responsorialPsalm.citation}</h3>
    <div class="refrain">R. ${p.responsorialPsalm.refrain}</div>
    <h3>Second Reading — ${p.secondReading.citation}</h3>
    <div class="reading">${p.secondReading.text}</div>
    <div class="dialogue"><span class="v">Lector:</span> The Word of the Lord. <span class="r">Thanks be to God.</span></div>
  </div>

  <div class="col">
    <h3>Gospel Acclamation</h3>
    ${acclamationText}
    <div class="reading" style="text-align:center;">${p.gospelAcclamation.verse}</div>
    <h3>Gospel — ${p.gospel.citation}</h3>
    <div class="dialogue"><span class="v">Deacon:</span> The Lord be with you. <span class="r">And with your spirit.</span></div>
    <div class="reading">${p.gospel.text}</div>
    <div class="dialogue"><span class="v">Deacon:</span> The Gospel of the Lord. <span class="r">Praise to you, Lord Jesus Christ.</span></div>
    <p class="rubric" style="margin-top:4pt;">Homily — the priest or deacon preaches.</p>
    <h3>Nicene Creed</h3>
    <div class="prayer">
      I believe in one God, the Father almighty, maker of heaven and earth, of all things visible and invisible.
      I believe in one Lord Jesus Christ, the Only Begotten Son of God, born of the Father before all ages.
      God from God, Light from Light, true God from true God, begotten, not made, consubstantial with the Father; through him all things were made.
      For us men and for our salvation he came down from heaven,
      <span class="rubric">(bow)</span>
      and by the Holy Spirit was incarnate of the Virgin Mary, and became man.
      <span class="rubric">(rise)</span>
      For our sake he was crucified under Pontius Pilate, he suffered death and was buried, and rose again on the third day in accordance with the Scriptures.
      He ascended into heaven and is seated at the right hand of the Father.
      He will come again in glory to judge the living and the dead and his kingdom will have no end.
      I believe in the Holy Spirit, the Lord, the giver of life, who proceeds from the Father and the Son, who with the Father and the Son is adored and glorified, who has spoken through the prophets.
      I believe in one, holy, catholic and apostolic Church.
      I confess one Baptism for the forgiveness of sins and I look forward to the resurrection of the dead and the life of the world to come. Amen.
    </div>
    <h3>Prayer of the Faithful</h3>
    <div class="dialogue"><span class="r">Lord, hear our prayer.</span></div>
  </div>
</div>

<!-- SIDE 2 (Back) -->
<div class="page">
  <div class="col">
    <h2>III. Liturgy of the Eucharist</h2>
    <h3>Preparation of the Gifts</h3>
    <div class="dialogue">
      <span class="v">P:</span> Blessed are you, Lord God of all creation&hellip;<br>
      <span class="r">Blessed be God for ever.</span>
    </div>
    <div class="dialogue">
      <span class="v">P:</span> Pray, brethren, that my sacrifice and yours may be acceptable to God, the almighty Father.<br>
      <span class="r">May the Lord accept the sacrifice at your hands
      for the praise and glory of his name,
      for our good and the good of all his holy Church.</span>
    </div>
    <h3>Preface Dialogue</h3>
    <div class="dialogue">
      <span class="v">P:</span> The Lord be with you. <span class="r">And with your spirit.</span><br>
      <span class="v">P:</span> Lift up your hearts. <span class="r">We lift them up to the Lord.</span><br>
      <span class="v">P:</span> Let us give thanks to the Lord our God. <span class="r">It is right and just.</span>
    </div>
    <h3>Holy, Holy, Holy</h3>
    <div class="prayer">
      Holy, Holy, Holy Lord God of hosts.<br>
      Heaven and earth are full of your glory.<br>
      Hosanna in the highest.<br>
      Blessed is he who comes in the name of the Lord.<br>
      Hosanna in the highest.
    </div>
    <p class="rubric" style="margin-top:4pt;">The priest prays the Eucharistic Prayer.</p>
    <h3>Memorial Acclamation</h3>
    <div class="dialogue"><span class="v">P:</span> The mystery of faith.</div>
    <div class="prayer">
      We proclaim your Death, O Lord,<br>
      and profess your Resurrection<br>
      until you come again.
    </div>
    <h3>The Lord's Prayer</h3>
    <div class="prayer">
      Our Father, who art in heaven,<br>
      hallowed be thy name;<br>
      thy kingdom come,<br>
      thy will be done<br>
      on earth as it is in heaven.<br>
      Give us this day our daily bread,<br>
      and forgive us our trespasses,<br>
      as we forgive those who trespass against us;<br>
      and lead us not into temptation,<br>
      but deliver us from evil.
    </div>
    <div class="dialogue"><span class="r">For the kingdom, the power and the glory are yours now and for ever.</span></div>
  </div>

  <div class="col">
    <h3>Sign of Peace</h3>
    <div class="dialogue"><span class="v">P:</span> The peace of the Lord be with you always. <span class="r">And with your spirit.</span></div>
    <h3>Lamb of God</h3>
    <div class="prayer">
      Lamb of God, you take away the sins of the world, have mercy on us.<br>
      Lamb of God, you take away the sins of the world, have mercy on us.<br>
      Lamb of God, you take away the sins of the world, grant us peace.
    </div>
    <h3>Communion</h3>
    <div class="dialogue"><span class="v">P:</span> Behold the Lamb of God, behold him who takes away the sins of the world. Blessed are those called to the supper of the Lamb.</div>
    <div class="prayer">
      Lord, I am not worthy<br>
      that you should enter under my roof,<br>
      but only say the word<br>
      and my soul shall be healed.
    </div>
    <h2>IV. Concluding Rites</h2>
    <div class="dialogue" style="margin-top:4pt;">
      <span class="v">P:</span> The Lord be with you. <span class="r">And with your spirit.</span><br>
      <span class="v">P:</span> May almighty God bless you, the Father, and the Son, &#10013; and the Holy Spirit. <span class="r">Amen.</span><br>
      <span class="v">Deacon:</span> Go forth, the Mass is ended. <span class="r">Thanks be to God.</span>
    </div>
    <div style="margin-top: 16pt; padding-top: 8pt; border-top: 1px solid #ddd;">
      <p style="font-size: 10.5pt; color: #666; line-height: 1.3;">
        <strong style="color:#4a0e4e;">Today's Theme</strong><br>
        ${p.theme}
      </p>
    </div>
  </div>
</div>

</body>
</html>`;
}
