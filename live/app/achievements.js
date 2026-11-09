/* SHLIFIM achievements — 35 badges. Each check(m) reads a metrics snapshot:
   m = { studied, hard, dayStreak, maxDayStreak, answered, correct, accuracy,
         quizzes, perfect, topicsCompleted, topicDone:{key:bool}, usedDark, cwSolved }

   desc = what you did (shown once the badge is earned)
   todo = what you still have to DO, in the imperative (shown while it is locked)
   prog = m => [have, need] for countable goals, so a student sees exactly how close they are.
          Omitted for compound or yes/no conditions, where a bar would mislead.

   Thresholds are derived from the real data: a hard-coded 465 used to make 'all'
   mathematically unreachable, because the glossary holds 464 terms. */
(function () {
  var NT = ((window.GLOSSARY || []).length) || 464;   // terms in the glossary
  var NK = ((window.TOPICS || []).length) || 21;      // topics

  window.ACHIEVEMENTS = [
    { id:'first',     emoji:'🌱', title:'צעד ראשון',   desc:'סימנת מושג ראשון כנלמד', todo:'סמנו מושג אחד כנלמד',              prog:m=>[m.studied,1],   check:m=>m.studied>=1 },
    { id:'ten',       emoji:'🔟', title:'עשירייה',     desc:'10 מושגים שנלמדו',        todo:'סמנו 10 מושגים כנלמדו',            prog:m=>[m.studied,10],  check:m=>m.studied>=10 },
    { id:'quarter',   emoji:'📗', title:'רבע הדרך',    desc:'25 מושגים שנלמדו',        todo:'סמנו 25 מושגים כנלמדו',            prog:m=>[m.studied,25],  check:m=>m.studied>=25 },
    { id:'fifty',     emoji:'🏅', title:'חמישים!',     desc:'50 מושגים שנלמדו',        todo:'סמנו 50 מושגים כנלמדו',            prog:m=>[m.studied,50],  check:m=>m.studied>=50 },
    { id:'hundred',   emoji:'💯', title:'מאה מושגים',  desc:'100 מושגים שנלמדו',       todo:'סמנו 100 מושגים כנלמדו',           prog:m=>[m.studied,100], check:m=>m.studied>=100 },
    { id:'twohundred',emoji:'🚀', title:'מאתיים',      desc:'200 מושגים שנלמדו',       todo:'סמנו 200 מושגים כנלמדו',           prog:m=>[m.studied,200], check:m=>m.studied>=200 },
    { id:'threehundred',emoji:'🌟',title:'שלוש מאות',  desc:'300 מושגים שנלמדו',       todo:'סמנו 300 מושגים כנלמדו',           prog:m=>[m.studied,300], check:m=>m.studied>=300 },
    { id:'all',       emoji:'👑', title:'מלך המושגים', desc:'כל '+NT+' המושגים!',      todo:'סמנו את כל '+NT+' המושגים כנלמדו', prog:m=>[m.studied,NT],  check:m=>m.studied>=NT },

    { id:'streak2',   emoji:'🔥', title:'יומיים ברצף', desc:'נכנסת יומיים רצופים', todo:'היכנסו לאפליקציה יומיים ברצף', prog:m=>[m.dayStreak,2],  check:m=>m.dayStreak>=2 },
    { id:'streak3',   emoji:'🔥', title:'שלושה ימים',  desc:'3 ימים רצופים',       todo:'היכנסו 3 ימים ברצף',           prog:m=>[m.dayStreak,3],  check:m=>m.dayStreak>=3 },
    { id:'streak7',   emoji:'📅', title:'שבוע שלם',    desc:'7 ימים רצופים',       todo:'היכנסו 7 ימים ברצף',           prog:m=>[m.dayStreak,7],  check:m=>m.dayStreak>=7 },
    { id:'streak14',  emoji:'🗓️', title:'שבועיים',     desc:'14 ימים רצופים',      todo:'היכנסו 14 ימים ברצף',          prog:m=>[m.dayStreak,14], check:m=>m.dayStreak>=14 },
    { id:'streak30',  emoji:'🏆', title:'חודש מלא!',   desc:'30 ימים רצופים',      todo:'היכנסו 30 ימים ברצף',          prog:m=>[m.dayStreak,30], check:m=>m.dayStreak>=30 },

    { id:'firstquiz', emoji:'✅', title:'המבחון הראשון', desc:'סיימת מבחון ראשון', todo:'סיימו מבחון אחד עד הסוף',            prog:m=>[m.quizzes,1],   check:m=>m.quizzes>=1 },
    { id:'q50',       emoji:'🎯', title:'50 שאלות',      desc:'ענית על 50 שאלות',  todo:'ענו על 50 שאלות במבחונים',           prog:m=>[m.answered,50], check:m=>m.answered>=50 },
    { id:'q200',      emoji:'🎯', title:'200 שאלות',     desc:'ענית על 200 שאלות', todo:'ענו על 200 שאלות במבחונים',          prog:m=>[m.answered,200],check:m=>m.answered>=200 },
    { id:'perfect1',  emoji:'🌈', title:'מבחון מושלם',   desc:'100% במבחון',       todo:'סיימו מבחון בלי אף טעות',            prog:m=>[m.perfect,1],   check:m=>m.perfect>=1 },
    { id:'perfect5',  emoji:'💎', title:'5 מושלמים',     desc:'5 מבחנים מושלמים',  todo:'סיימו 5 מבחונים בלי אף טעות',        prog:m=>[m.perfect,5],   check:m=>m.perfect>=5 },
    { id:'acc80',     emoji:'🧠', title:'דייקנות 80%',   desc:'80%+ על 20 שאלות',  todo:'ענו על 20 שאלות לפחות, עם 80% דיוק ומעלה', check:m=>m.answered>=20 && m.accuracy>=0.8 },
    { id:'acc95',     emoji:'🦉', title:'דייקן-על',      desc:'95%+ על 50 שאלות',  todo:'ענו על 50 שאלות לפחות, עם 95% דיוק ומעלה', check:m=>m.answered>=50 && m.accuracy>=0.95 },

    { id:'topic1',    emoji:'🧩', title:'נושא ראשון', desc:'השלמת נושא שלם',            todo:'סמנו כנלמדו את כל המושגים בנושא אחד', prog:m=>[m.topicsCompleted,1],  check:m=>m.topicsCompleted>=1 },
    { id:'topic5',    emoji:'🗂️', title:'5 נושאים',   desc:'השלמת 5 נושאים',            todo:'השלימו 5 נושאים שלמים',               prog:m=>[m.topicsCompleted,5],  check:m=>m.topicsCompleted>=5 },
    { id:'topic10',   emoji:'📚', title:'10 נושאים',  desc:'השלמת 10 נושאים',           todo:'השלימו 10 נושאים שלמים',              prog:m=>[m.topicsCompleted,10], check:m=>m.topicsCompleted>=10 },
    { id:'topicall',  emoji:'🌍', title:'כל הנושאים!',desc:'השלמת את כל '+NK+' הנושאים', todo:'השלימו את כל '+NK+' הנושאים',         prog:m=>[m.topicsCompleted,NK], check:m=>m.topicsCompleted>=NK },

    { id:'mcell',  emoji:'🧬', title:'מאסטר מאפייני חיים', desc:'נושא מאפייני חיים הושלם', todo:'השלימו את כל המושגים בנושא מאפייני חיים', check:m=>!!m.topicDone['מאפייני חיים'] },
    { id:'mgen',   emoji:'🧪', title:'מאסטר תורשה',        desc:'תורשה מנדלית הושלם',      todo:'השלימו את כל המושגים בנושא תורשה מנדלית',  check:m=>!!m.topicDone['תורשה מנדלית'] },
    { id:'mheart', emoji:'❤️', title:'מאסטר ההובלה',       desc:'מערכת ההובלה הושלמה',     todo:'השלימו את כל המושגים בנושא מערכת הובלה',   check:m=>!!m.topicDone['מערכת הובלה'] },
    { id:'meco',   emoji:'🌱', title:'אקולוג',             desc:'אקולוגיה הושלמה',         todo:'השלימו את כל המושגים בנושא אקולוגיה',      check:m=>!!m.topicDone['אקולוגיה'] },
    { id:'mmicro', emoji:'🦠', title:'מיקרוביולוג',        desc:'מיקרוביולוגיה הושלמה',    todo:'השלימו את כל המושגים בנושא מיקרוביולוגיה', check:m=>!!m.topicDone['מיקרוביולוגיה'] },

    { id:'pin1',     emoji:'📌', title:'מיקוד',      desc:'סימנת מושג לחזרה', todo:'סמנו מושג אחד לחזרה בסימניה',        prog:m=>[m.hard,1], check:m=>m.hard>=1 },
    { id:'pin5',     emoji:'📍', title:'רשימת חזרה', desc:'5 מושגים לחזרה',   todo:'סמנו 5 מושגים לחזרה',                prog:m=>[m.hard,5], check:m=>m.hard>=5 },
    { id:'nightowl', emoji:'🌙', title:'ינשוף לילה', desc:'למדת במצב לילה',   todo:'הדליקו מצב לילה בכפתור שבראש המסך',  check:m=>!!m.usedDark },

    { id:'cw1',  emoji:'🧩', title:'תשבצן מתחיל',  desc:'פתרת תשבץ ראשון', todo:'פתרו תשבץ אחד במלואו', prog:m=>[m.cwSolved,1],  check:m=>m.cwSolved>=1 },
    { id:'cw5',  emoji:'🧩', title:'חובב תשבצים',  desc:'פתרת 5 תשבצים',   todo:'פתרו 5 תשבצים',        prog:m=>[m.cwSolved,5],  check:m=>m.cwSolved>=5 },
    { id:'cw15', emoji:'👑', title:'אלוף התשבצים', desc:'פתרת 15 תשבצים',  todo:'פתרו 15 תשבצים',       prog:m=>[m.cwSolved,15], check:m=>m.cwSolved>=15 }
  ];
})();
