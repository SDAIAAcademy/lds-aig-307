// The case study's fixed content: Al-Jathjath City Municipality, Home Business Permits Service.
// Everything here is fictional. The rules below are the case organisation's own, written for the
// course; they are not the text of any national reference.

export const ORG = 'خدمة تصاريح الأعمال المنزلية في أمانة مدينة الجَثجاث';

export const DECISIONS = {
  approve: 'موافقة',
  request: 'طلب مستندات',
  refuse: 'رفض',
};

// Activities, by the organisation's list (rule R1)
export const ACTIVITIES = {
  permitted: [
    'خياطة وتطريز', 'تصميم جرافيكي', 'ترجمة تحريرية', 'تغليف هدايا', 'صناعة إكسسوارات يدوية',
    'تصوير منتجات', 'برمجة مواقع', 'تنسيق زهور', 'عطور وبخور (تعبئة وبيع)', 'تدقيق لغوي',
    'تصميم داخلي على الحاسب', 'إعداد مخططات هندسية على الحاسب', 'صيانة ملابس وتعديلها', 'رسم وفنون تشكيلية',
  ],
  food: ['إعداد الحلويات', 'إعداد وجبات منزلية', 'تحضير القهوة والتمور للمناسبات', 'إعداد المخبوزات'],
  notHome: ['صيانة السيارات', 'تخزين مواد كيميائية', 'أعمال حدادة ولحام', 'بيع الحيوانات وتربيتها', 'أعمال إنشائية في الموقع'],
};

export const RULES = [
  { id: 'R1', text: 'أن يكون النشاط في قائمة الأنشطة المسموح بها منزليًا. النشاط غير المسموح: رفض.' },
  { id: 'R6', text: 'ألا تكون على العنوان نفسه (المبنى والوحدة) مخالفة غير مسوّاة خلال 12 شهرًا. إن وُجدت: رفض.' },
  { id: 'R4', text: 'الزوار المتوقعون يوميًا: 5 على الأكثر في الشقة، و15 على الأكثر في الفيلا أو الدور المستقل. إن زادوا: رفض، ويجوز التقدم من جديد بعدد أقل.' },
  { id: 'R2', text: 'الأنشطة الغذائية: شهادة صحية سارية في تاريخ الطلب. إن غابت أو انتهت: طلب مستندات.' },
  { id: 'R3', text: 'السكن المستأجر: خطاب موافقة المالك مرفق. إن غاب: طلب مستندات.' },
  { id: 'R5', text: 'هوية مقدم الطلب سارية في تاريخ الطلب. إن انتهت: طلب مستندات.' },
];

// Seeded error types of the permit queue (sets A and B)
export const ERROR_TYPES = {
  T1: { visibility: 'documents', direction: 'favours-applicant', label: 'تاريخ الشهادة الصحية مقروء خطأ: منتهية في المستند، سارية في الملخص' },
  T2: { visibility: 'documents', direction: 'favours-applicant', label: 'موافقة المالك «مرفقة» في الملخص، وغائبة من المستندات' },
  T3: { visibility: 'summary', direction: 'against-applicant', label: 'نشاط مسموح صُنّف «أعمال إنشائية» فرُفض' },
  T4: { visibility: 'summary', direction: 'favours-applicant', label: 'زوار الشقة فوق الحد، والتوصية موافقة' },
  T5: { visibility: 'documents', direction: 'against-applicant', label: 'مخالفة لعنوان آخر نُسبت إلى مقدم الطلب فرُفض' },
  T6: { visibility: 'summary', direction: 'favours-applicant', label: 'الهوية منتهية في الملخص نفسه، والتوصية موافقة' },
};

// Positions of the seeded errors: halves and visibility are matched between A and B
export const PLAN = {
  A: { size: 60, seed: 3071, errors: { 4: 'T3', 9: 'T1', 15: 'T4', 19: 'T2', 24: 'T6', 28: 'T5', 35: 'T1', 39: 'T4', 44: 'T5', 49: 'T3', 53: 'T2', 58: 'T6' } },
  B: { size: 40, seed: 3072, errors: { 5: 'T2', 9: 'T3', 14: 'T5', 18: 'T4', 25: 'T6', 29: 'T1', 34: 'T3', 38: 'T2' } },
};

// Capstone queue C: the violation-notice assistant of the same service
export const C_DECISIONS = { none: 'لا مخالفة', warning: 'إنذار', fine: 'مخالفة بغرامة' };
export const C_RULES = [
  { id: 'V1', text: 'ملاحظة لا تسندها صورة أو قراءة في تقرير المعاينة: لا مخالفة.' },
  { id: 'V2', text: 'ملاحظة صُححت أثناء الزيارة وأثبتها المراقب في التقرير: لا مخالفة.' },
  { id: 'V3', text: 'ملاحظة جسيمة (سلامة أو صحة عامة)، أو ملاحظة تكررت على التصريح نفسه خلال 6 أشهر: مخالفة بغرامة.' },
  { id: 'V4', text: 'غير ذلك (ملاحظة بسيطة أولى): إنذار.' },
];
export const C_ERROR_TYPES = {
  C1: { visibility: 'summary', direction: 'against-applicant', label: 'غرامة على ملاحظة بسيطة أولى' },
  C2: { visibility: 'documents', direction: 'favours-applicant', label: 'تكرار خلال 6 أشهر في سجل التصريح، والتوصية إنذار' },
  C3: { visibility: 'documents', direction: 'against-applicant', label: 'صُححت أثناء الزيارة في التقرير، والتوصية مخالفة' },
  C4: { visibility: 'summary', direction: 'favours-applicant', label: 'ملاحظة جسيمة، والتوصية إنذار' },
};
export const C_PLAN = { size: 40, seed: 3073, errors: { 3: 'C1', 8: 'C2', 13: 'C3', 19: 'C4', 23: 'C2', 28: 'C1', 33: 'C4', 37: 'C3' } };

export const MINOR_FINDINGS = ['لافتة أكبر من المقاس المسموح', 'ركن مركبات العملاء أمام مدخل الجار', 'عرض بضاعة خارج حدود المنزل', 'إزعاج بعد المدة المسموح بها للزيارات', 'لوحة التصريح غير معروضة'];
export const MAJOR_FINDINGS = ['تخزين أسطوانات غاز قرب مصدر حرارة', 'إعداد طعام دون شهادة صحية سارية', 'توصيلات كهربائية مكشوفة في مكان العمل', 'سد مخرج الطوارئ ببضاعة'];

// The case-handling agent Mutammim: twelve action types
export const ACTION_TYPES = [
  { type: 'send_reminder', ar: 'تذكير بمستند ناقص', count: 20 },
  { type: 'request_documents', ar: 'طلب مستندات', count: 20 },
  { type: 'schedule_inspection', ar: 'حجز زيارة معاينة', count: 15 },
  { type: 'update_address_record', ar: 'تعديل بيانات العنوان في السجل', count: 7 },
  { type: 'issue_permit', ar: 'إصدار تصريح بعد توصية الموافقة', count: 40 },
  { type: 'close_inactive_file', ar: 'إغلاق ملف غير مكتمل بعد 30 يومًا', count: 20 },
  { type: 'share_with_inspection', ar: 'إحالة الملف كاملًا إلى فريق المعاينة', count: 25 },
  { type: 'refund_fee', ar: 'رد رسوم', count: 15 },
  { type: 'send_refusal_notice', ar: 'إرسال إشعار رفض', count: 20 },
  { type: 'issue_violation_notice', ar: 'إرسال إشعار مخالفة بغرامة', count: 10 },
  { type: 'suspend_permit', ar: 'تعليق تصريح ساري بعد بلاغ', count: 6 },
  { type: 'send_bulk_announcement', ar: 'رسالة جماعية إلى حاملي التصاريح', count: 2 },
];

export const OFFICERS = ['O-01', 'O-02', 'O-03', 'O-04', 'O-05', 'O-06'];
export const DAYS = ['2027-03-07', '2027-03-08', '2027-03-09', '2027-03-10', '2027-03-11', '2027-03-14', '2027-03-15', '2027-03-16', '2027-03-17', '2027-03-18'];

// Capstone agent: the violation-notice agent gets the new permissions of the autonomy raise
export const C_ACTION_TYPES = [
  { type: 'send_inspection_summary', ar: 'إرسال ملخص المعاينة إلى صاحب التصريح', count: 30 },
  { type: 'issue_warning', ar: 'إرسال إنذار', count: 30 },
  { type: 'issue_fine', ar: 'إرسال مخالفة بغرامة', count: 20 },
  { type: 'schedule_reinspection', ar: 'حجز معاينة لاحقة', count: 25 },
  { type: 'waive_fine', ar: 'إلغاء غرامة بعد تظلم مقبول', count: 8 },
  { type: 'publish_compliance_list', ar: 'نشر قائمة الملتزمين في الحي', count: 2 },
  { type: 'suspend_permit', ar: 'تعليق تصريح بعد مخالفة ثالثة', count: 5 },
];
