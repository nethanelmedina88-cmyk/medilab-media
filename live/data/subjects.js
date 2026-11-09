// SHLIFIM subject taxonomy — confirmed by teacher 2026-06-09 (subtopics revised).
// 6 subjects: 3 core (ליבה) + 3 depth (העמקה). Only התא and גוף האדם have subtopics;
// the other four are not divided into subtopics. `subject` stored on each glossary term is
// the Hebrew `name`; `subtopic` (when present) is one of the subject's subtopics.
window.SUBJECTS = {
  core: [
    {
      key: 'cell', name: 'התא', track: 'core',
      subtopics: [
        'מבוא ומאפייני חיים',
        'מעבר חומרים דרך קרום תא',
        'חלבונים ואנזימים',
        'פוטוסינתזה',
        'נשימה תאית ותסיסה',
        'החומר התורשתי',
        'מחזור התא (מיטוזה/מיוזה)',
        'מדנ"א לחלבון',
        'תורשה מנדלית'
      ]
    },
    {
      key: 'human-body', name: 'גוף האדם', track: 'core',
      subtopics: [
        'מבוא לגוף האדם',
        'מערכת העיכול',
        'מערכת הנשימה',
        'מערכת ההובלה',
        'מערכת החיסון',
        'מערכת השתן',
        'המערכת ההורמונלית',
        'מערכת העצבים',
        'מערכת הרבייה'
      ]
    },
    { key: 'ecology', name: 'אקולוגיה', track: 'core', subtopics: [] }
  ],
  depth: [
    { key: 'microbiology', name: 'מיקרוביולוגיה', track: 'depth', subtopics: [] },
    { key: 'comparative-physiology', name: 'פיזיולוגיה השוואתית', track: 'depth', subtopics: [] },
    { key: 'genetic-engineering', name: 'הנדסה גנטית', track: 'depth', subtopics: [] }
  ]
};
