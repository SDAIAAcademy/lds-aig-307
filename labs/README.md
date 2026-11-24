# مختبرات المقرر LDS-AIG-307

البيانات كلها اصطناعية ببذور ثابتة، وأمانة مدينة الجَثجاث وأشخاصها افتراضيون. «مُرجِّح» و«مُتمِّم» ومساعد إشعارات المخالفات محاكاة في ملفات البيانات: لا يستدعي أي مختبر نموذجًا ولا يرسل شيئًا إلى الشبكة.

## نقطة البداية والحل لكل مختبر

| المختبر | يبدأ من | الحل المرجعي |
|---|---|---|
| 1.1 مراجعة 60 حالة | `files/queue/queue.html` (المجموعة A)، و`files/d1_1/result_card.md` فارغة | `solutions/reference/queue_key.json`، و`answer_key.md` |
| 1.2 إعادة التصميم | `files/d1_2/` والمجموعة B، و`baseline_log_R07.csv` لمن لا يبدأ من نتيجته | `redesign_reference.md`، و`stats.json` |
| 1.3 إعادة التشغيل | `files/d1_3/thresholds_start.json` (كل إجراء تلقائي) و`replay.py` | `thresholds_reference.json`، و`replay_reference.json`، و`threshold_rationale_reference.md` |
| المساء: مسار التظلم | `files/evening/` | `appeal_route_reference.md` |
| 2.1 اللجنة الصورية | `files/d2_1/procedure_draft.md` ناقصة، والملفان | `procedure_reference.md`، و`decision_records_reference.md` |
| المشروع الختامي | `files/capstone/` | `capstone_key.md`، و`capstone_thresholds_reference.json`، و`capstone_replay.json` |

لا يوزَّع شيء من `solutions/` على المشاركين قبل أن يسلّموا. ملف المفتاح `queue_key.json` يُعطى بعد أن ينزّل الجميع سجلاتهم.

## تشغيل الأدوات

من جذر المقرر:

```
node labs/_tools/build.mjs      # يعيد كتابة البيانات وصفحة قائمة الانتظار وملفات المرجع (النتيجة نفسها في كل مرة)
node labs/_tools/extras.mjs     # الأرقام الإضافية في الإجابات والشرائح والبنك
node labs/solutions/check.mjs   # يتحقق من المفاتيح، والسجل المرجعي، وإعادة التشغيل بالبرنامجين
```

يحتاج `check.mjs` إلى `uv` ليشغّل `replay.py` (بايثون 3.10 أو أحدث، دون مكتبات). وفي المختبر 1.3 يشغّل المشارك من `labs/files/d1_3`:

```
uv run replay.py thresholds_start.json
uv run replay.py my_thresholds.json --out held.csv
```

أو `python replay.py ...`، أو `%run replay.py ...` في JupyterLab أو خدمة دفاتر مستضافة مجانية. احذف `held.csv` وأي سجل جلسة قبل أن تعيد الملفات إلى المستودع.

## قائمة الانتظار

`files/queue/queue.html` صفحة واحدة تعمل من الملف أو من أي خادم ثابت: المجموعات A وB وC، والأدوات الخمس للمجموعتين B وC، و45 ثانية لكل طلب، وتنزيل السجل بصيغة CSV. لا يوجد المفتاح في الصفحة. `files/queue/score.html` تقرأ السجلات وملف المفتاح وتحسب معدل الاكتشاف وفترة الثقة 95% (فترة ويلسون) والحكم. البديل دون متصفح: `cases_A.csv` و`cases_B.csv` و`files/capstone/cases_C.csv` في جدول بيانات بمؤقت يديره المدرب.
