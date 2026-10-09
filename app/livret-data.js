/* =====================================================================
   Ryze — livret-data.js : contenu bilingue (français / arabe) du carnet
   patient remis aux familles (format A5). Généré depuis le pack de contenu
   relu « contenu-carnet-final.json » (0.3-carnet4p-relu, relu le 2026-09-30) ;
   les chaînes sont copiées telles quelles (marques bidi invisibles conservées,
   écrites \u200E, \u2066…\u2069, \u00A0). « livret » devient « carnet » en
   français, comme dans la maquette. Les chaînes de _nouvelles (pédiatrie,
   pluriels arabes, jours de la semaine) sont à faire relire.
   Convention : chaque texte est { fr, ar } ; si = condition d'affichage
   (voie IV|SC|PO, sexe F|M, classe antiTNF|vedolizumab|antiIL|JAK,
   associe methotrexate|thiopurine|mesalazine) ; p = priorité (1 = indispensable).
   ===================================================================== */
'use strict';
window.RYZE = window.RYZE || {};
window.RYZE.LIVRET = {
 "version": "0.3-carnet4p-relu (2026-09-30)",
 "titre": {
  "fr": "Mon carnet de suivi",
  "ar": "دفتر متابعتي"
 },
 "sousTitre": {
  "fr": "Traitement par biothérapie — Hôpital de jour",
  "ar": "العلاج البيولوجي — مستشفى النهار"
 },
 "etiquette": {
  "fr": "Étiquette de l’hôpital (à coller)",
  "ar": "ملصق المستشفى (يُلصق هنا)"
 },
 "dossierNo": {
  "fr": "dossier n°",
  "ar": "رقم الملف"
 },
 "remisLe": {
  "fr": "Carnet remis le",
  "ar": "تاريخ تسليم الدفتر"
 },
 "remisPar": {
  "fr": "par",
  "ar": "من طرف"
 },
 "carnetNo": {
  "fr": "Carnet n°",
  "ar": "دفتر رقم"
 },
 "page": {
  "fr": "Page",
  "ar": "صفحة"
 },
 "p1": {
  "moi": {
   "titre": {
    "fr": "Moi",
    "ar": "معلوماتي"
   },
   "nom": {
    "fr": "Nom",
    "ar": "الاسم العائلي"
   },
   "prenom": {
    "fr": "Prénom",
    "ar": "الاسم الشخصي"
   },
   "ddn": {
    "fr": "Date de naissance",
    "ar": "تاريخ الميلاد"
   },
   "sexe": {
    "fr": "Sexe",
    "ar": "الجنس"
   },
   "dossier": {
    "fr": "N° de dossier à l’hôpital",
    "ar": "رقم الملف في المستشفى"
   },
   "cin": {
    "fr": "N° de CIN",
    "ar": "رقم البطاقة الوطنية (CIN)"
   },
   "tel": {
    "fr": "Mon téléphone",
    "ar": "رقم هاتفي"
   },
   "adresse": {
    "fr": "Adresse",
    "ar": "العنوان"
   },
   "poids": {
    "fr": "Poids (kg)",
    "ar": "الوزن (كغ)"
   },
   "taille": {
    "fr": "Taille (cm)",
    "ar": "الطول (سم)"
   },
   "groupe-sanguin": {
    "fr": "Groupe sanguin",
    "ar": "الفصيلة الدموية"
   },
   "allergies": {
    "fr": "Allergies connues",
    "ar": "الحساسية المعروفة"
   },
   "vaccins": {
    "fr": "Vaccins faits (dates)",
    "ar": "اللقاحات التي تلقيتها (التواريخ)"
   }
  },
  "sexe": {
   "F": {
    "fr": "Femme",
    "ar": "أنثى"
   },
   "M": {
    "fr": "Homme",
    "ar": "ذكر"
   },
   "fille": {
    "fr": "Fille",
    "ar": "أنثى"
   },
   "garcon": {
    "fr": "Garçon",
    "ar": "ذكر"
   }
  },
  "prevenir": {
   "titre": {
    "fr": "Personne à prévenir",
    "ar": "الشخص الذي يُتَّصل به عند الحاجة"
   },
   "prevenir-nom": {
    "fr": "Nom et prénom",
    "ar": "الاسم الكامل"
   },
   "prevenir-lien": {
    "fr": "Lien (époux, fille, voisin…)",
    "ar": "صلته بي (زوج، زوجة، ابنة، جار…)"
   },
   "prevenir-tel": {
    "fr": "Téléphone",
    "ar": "الهاتف"
   }
  },
  "maladie": {
   "titre": {
    "fr": "Ma maladie",
    "ar": "مرضي"
   },
   "maladie-nom": {
    "fr": "Nom de la maladie",
    "ar": "اسم المرض"
   },
   "date-diag": {
    "fr": "Date du diagnostic",
    "ar": "تاريخ التشخيص"
   }
  },
  "maladies": {
   "MC": {
    "fr": "Maladie de Crohn",
    "ar": "مرض كرون"
   },
   "RCH": {
    "fr": "Rectocolite hémorragique (RCH)",
    "ar": "التهاب القولون التقرحي (RCH)"
   }
  },
  "traitement": {
   "titre": {
    "fr": "Mon traitement",
    "ar": "علاجي"
   },
   "tt-nom": {
    "fr": "Nom du médicament",
    "ar": "اسم الدواء"
   },
   "tt-boite": {
    "fr": "Nom écrit sur la boîte",
    "ar": "الاسم المكتوب على العلبة"
   },
   "tt-classe": {
    "fr": "Type de médicament",
    "ar": "نوع الدواء"
   },
   "tt-comment": {
    "fr": "Comment",
    "ar": "طريقة العلاج"
   },
   "tt-rythme": {
    "fr": "Rythme",
    "ar": "وتيرة العلاج"
   },
   "tt-dose": {
    "fr": "Dose (posologie)",
    "ar": "الجرعة"
   },
   "tt-debut": {
    "fr": "Date de début du traitement",
    "ar": "تاريخ بداية العلاج"
   },
   "tt-premed": {
    "fr": "Médicament donné avant la perfusion (prémédication)",
    "ar": "دواء يُعطى قبل التسريب (التحضير الدوائي)"
   },
   "tt-autres": {
    "fr": "Autres médicaments pour ma maladie",
    "ar": "أدوية أخرى لمرضي"
   }
  },
  "classes": {
   "antiTNF": {
    "fr": "Anti-TNF",
    "ar": "مضاد TNF (Anti-TNF)"
   },
   "vedolizumab": {
    "fr": "Anti-intégrine (vedolizumab)",
    "ar": "مضاد الإنتغرين (vedolizumab)"
   },
   "antiIL": {
    "fr": "Anti-interleukine (anti-IL)",
    "ar": "مضاد الإنترلوكين (anti-IL)"
   },
   "JAK": {
    "fr": "Inhibiteur de JAK (comprimé)",
    "ar": "مثبط JAK (أقراص)"
   }
  },
  "voies": {
   "IV": {
    "fr": "Perfusion à l’hôpital",
    "ar": "التسريب الوريدي في المستشفى"
   },
   "SC": {
    "fr": "Injection à la maison",
    "ar": "الحقن في المنزل"
   },
   "PO": {
    "fr": "Comprimés",
    "ar": "أقراص"
   }
  },
  "equipe": {
   "titre": {
    "fr": "Mon équipe",
    "ar": "فريقي الطبي"
   },
   "medecin": {
    "fr": "Mon médecin",
    "ar": "طبيبي المعالج"
   },
   "chef": {
    "fr": "Chef de service",
    "ar": "رئيس المصلحة"
   },
   "ide": {
    "fr": "Équipe infirmière de l’hôpital de jour",
    "ar": "الطاقم التمريضي لمستشفى النهار"
   },
   "etab": {
    "fr": "Établissement",
    "ar": "المؤسسة"
   },
   "service": {
    "fr": "Service",
    "ar": "المصلحة"
   },
   "hdj-nom": {
    "fr": "Hôpital de jour",
    "ar": "مستشفى النهار"
   },
   "hdj-adresse": {
    "fr": "Où ?",
    "ar": "أين؟"
   },
   "hdj-tel": {
    "fr": "Téléphone de l’hôpital de jour",
    "ar": "هاتف مستشفى النهار"
   },
   "hdj-horaires": {
    "fr": "Horaires",
    "ar": "أوقات العمل"
   }
  },
  "apporte": {
   "fr": "J’apporte à chaque séance :",
   "ar": "أُحضر معي في كل حصة:"
  },
  "apporteListe": {
   "fr": "ce carnet · CIN + papiers AMO · derniers résultats · ordonnances · liste de mes médicaments",
   "ar": "هذا الدفتر · البطاقة الوطنية ووثائق AMO · آخر النتائج · الوصفات · لائحة أدويتي"
  },
  "urgence": {
   "titre": {
    "fr": "En cas d’urgence",
    "ar": "في حالة الطوارئ"
   },
   "texte": {
    "fr": "Fièvre à 38 °C ou plus, ou signe qui vous inquiète : appelez l’hôpital de jour. La nuit, le week-end ou si personne ne répond : allez aux urgences. Dites que vous recevez une biothérapie et montrez ce carnet.",
    "ar": "حمى 38 درجة أو أكثر، أو أي علامة تقلقكم: اتصلوا بمستشفى النهار. في الليل، أو في نهاية الأسبوع، أو إذا لم يُجِب أحد: توجهوا إلى المستعجلات. قولوا إنكم تتلقون علاجًا بيولوجيًا وأظهروا هذا الدفتر."
   }
  },
  "piedApporter": {
   "fr": "Apportez ce carnet à chaque séance",
   "ar": "أحضروا هذا الدفتر في كل حصة"
  },
  "allergiesAucune": {
   "fr": "Aucune allergie connue",
   "ar": "لا توجد حساسية معروفة"
  },
  "horairesDuAu": {
   "fr": "Du {a} au {b}, de {h1} à {h2}",
   "ar": "من {a} إلى {b}، من {h1} إلى {h2}"
  },
  "rythmes": {
   "semaines": {
    "peu": {
     "fr": "Toutes les {n} semaines",
     "ar": "كل {n} أسابيع"
    },
    "un": {
     "fr": "Toutes les semaines",
     "ar": "كل أسبوع"
    },
    "deux": {
     "fr": "Toutes les 2 semaines",
     "ar": "كل أسبوعين"
    },
    "beaucoup": {
     "fr": "Toutes les {n} semaines",
     "ar": "كل {n} أسبوعًا"
    }
   },
   "jours": {
    "un": {
     "fr": "Tous les jours",
     "ar": "كل يوم"
    },
    "deux": {
     "fr": "Tous les 2 jours",
     "ar": "كل يومين"
    },
    "peu": {
     "fr": "Tous les {n} jours",
     "ar": "كل {n} أيام"
    },
    "beaucoup": {
     "fr": "Tous les {n} jours",
     "ar": "كل {n} يومًا"
    }
   },
   "po1": {
    "fr": "1 fois par jour",
    "ar": "مرة واحدة في اليوم"
   },
   "po2": {
    "fr": "2 fois par jour",
    "ar": "مرتين في اليوم"
   }
  },
  "heures": {
   "peu": {
    "fr": "Environ {n} heures",
    "ar": "حوالي {n} ساعات"
   },
   "un": {
    "fr": "Environ 1 heure",
    "ar": "حوالي ساعة واحدة"
   },
   "deux": {
    "fr": "Environ 2 heures",
    "ar": "حوالي ساعتين"
   },
   "beaucoup": {
    "fr": "Environ {n} heures",
    "ar": "حوالي {n} ساعة"
   }
  },
  "ecole": {
   "fr": "École (classe)",
   "ar": "المدرسة (القسم)"
  },
  "parents": {
   "titre": {
    "fr": "Mes parents ou mon tuteur (à prévenir)",
    "ar": "والداي أو وليّ أمري (يُتَّصل بهم عند الحاجة)"
   },
   "nom": {
    "fr": "Nom et prénom",
    "ar": "الاسم الكامل"
   },
   "lien": {
    "fr": "Lien (père, mère, tuteur…)",
    "ar": "صلته بي (أب، أم، وصيّ…)"
   },
   "tel": {
    "fr": "Téléphone",
    "ar": "الهاتف"
   },
   "autreTel": {
    "fr": "Autre téléphone",
    "ar": "هاتف آخر"
   }
  },
  "horairesListe": {
   "fr": "Le {jours}, de {h1} à {h2}",
   "ar": "يوم {jours}، من {h1} إلى {h2}"
  },
  "jours": {
   "0": {
    "fr": "dimanche",
    "ar": "الأحد"
   },
   "1": {
    "fr": "lundi",
    "ar": "الاثنين"
   },
   "2": {
    "fr": "mardi",
    "ar": "الثلاثاء"
   },
   "3": {
    "fr": "mercredi",
    "ar": "الأربعاء"
   },
   "4": {
    "fr": "jeudi",
    "ar": "الخميس"
   },
   "5": {
    "fr": "vendredi",
    "ar": "الجمعة"
   },
   "6": {
    "fr": "samedi",
    "ar": "السبت"
   }
  }
 },
 "p2": {
  "enTete": {
   "fr": "Mon planning de suivi",
   "ar": "برنامج متابعتي"
  },
  "titre": {
   "fr": "Mes séances",
   "ar": "حصصي العلاجية"
  },
  "sousTitre": {
   "fr": "Rempli à chaque venue à l’hôpital de jour",
   "ar": "يُملأ في كل زيارة لمستشفى النهار"
  },
  "aideCocher": {
   "fr": "Cochez et faites signer à chaque séance",
   "ar": "ضعوا علامة واطلبوا التوقيع في كل حصة"
  },
  "aideDates": {
   "fr": "Les dates sont prévues à l’avance. Elles peuvent changer : l’équipe corrige au stylo. Cochez la case quand la séance est faite.",
   "ar": "التواريخ محددة مسبقًا، وقد تتغير: يصحّحها الفريق بخط اليد. ضعوا علامة في الخانة بعد إجراء الحصة."
  },
  "legende": {
   "fr": "✓ fait · ✗ manqué · → reporté (nouvelle date à côté)",
   "ar": "✓ تمّ · ✗ لم يتم · ← أُجِّل (التاريخ الجديد بجانبه)"
  },
  "empeche": {
   "fr": "Empêché(e) ? Appelez tout de suite pour une nouvelle date.",
   "ar": "لا يمكنكم الحضور؟ اتصلوا فورًا لتحديد موعد جديد."
  },
  "retard": {
   "label": {
    "fr": "En retard ?",
    "ar": "متأخرون؟"
   },
   "texte": {
    "fr": "Appelez : le médicament est préparé pour vous.",
    "ar": "اتصلوا: الدواء يُحضَّر خصيصًا لكم."
   }
  },
  "avantDeVenir": {
   "label": {
    "fr": "Avant de venir",
    "ar": "قبل المجيء"
   },
   "texte": {
    "fr": "fièvre ? infection ? antibiotique ? grossesse ? opération ou dentiste prévu ? → appelez avant (page 4)",
    "ar": "حمى؟ عدوى؟ مضاد حيوي؟ حمل؟ عملية أو علاج أسنان مبرمج؟ ← اتصلوا قبل المجيء (الصفحة 4)"
   }
  },
  "dureeSurPlace": {
   "fr": "Temps prévu sur place",
   "ar": "المدة المتوقعة في المستشفى"
  },
  "cols": {
   "n": {
    "fr": "N°",
    "ar": "رقم"
   },
   "datePrevue": {
    "fr": "Date prévue",
    "ar": "التاريخ المقرر"
   },
   "dateFaite": {
    "fr": "Faite le",
    "ar": "أُجريت بتاريخ"
   },
   "dose": {
    "fr": "Dose (mg ou stylo)",
    "ar": "الجرعة (ملغ أو قلم حقن)"
   },
   "poids": {
    "fr": "Poids (kg)",
    "ar": "الوزن (كغ)"
   },
   "lot": {
    "fr": "N° de lot",
    "ar": "رقم الدفعة (Lot)"
   },
   "fait": {
    "fr": "Fait",
    "ar": "تمّ"
   },
   "tolerance": {
    "fr": "Tolérance / remarques",
    "ar": "التحمّل / ملاحظات"
   },
   "prochain": {
    "fr": "Prochain rendez-vous",
    "ar": "الموعد القادم"
   },
   "visa": {
    "fr": "Signature / cachet",
    "ar": "التوقيع / الختم"
   }
  },
  "quoi": {
   "perfusion": {
    "fr": "Perfusion",
    "ar": "تسريب وريدي"
   },
   "injection": {
    "fr": "Injection",
    "ar": "حقنة"
   }
  },
  "injections": {
   "titre": {
    "fr": "Mes injections à la maison",
    "ar": "حقني في المنزل"
   },
   "condition": {
    "fr": "Si je fais mes injections à la maison",
    "ar": "إذا كنت أحقن نفسي في المنزل"
   },
   "cols": {
    "date": {
     "fr": "Date",
     "ar": "التاريخ"
    },
    "endroit": {
     "fr": "Endroit",
     "ar": "مكان الحقن"
    },
    "parQui": {
     "fr": "Faite par",
     "ar": "قام بها"
    },
    "fait": {
     "fr": "Fait",
     "ar": "تمّ"
    },
    "probleme": {
     "fr": "Problème ? (rougeur, oubli…)",
     "ar": "مشكلة؟ (احمرار، نسيان…)"
    }
   },
   "oubli": {
    "titre": {
     "fr": "Si j’oublie une injection",
     "ar": "إذا نسيت حقنة"
    },
    "texte": {
     "fr": "Faites-la dès que vous y pensez, puis appelez l’hôpital de jour pour savoir quand faire la suivante. Ne faites jamais 2 injections pour rattraper.",
     "ar": "قوموا بها بمجرد أن تتذكروا، ثم اتصلوا بمستشفى النهار لمعرفة موعد الحقنة التالية. لا تقوموا أبدًا بحقنتين لتعويض الحقنة المنسية."
    }
   },
   "frigo": {
    "fr": "Stylos au réfrigérateur (2 à 8 °C), jamais au congélateur.",
    "ar": "الأقلام في الثلاجة (بين 2 و8 درجات)، وليس أبدًا في المجمّد."
   }
  },
  "report": {
   "titre": {
    "fr": "Si je ne peux pas venir",
    "ar": "إذا لم أستطع الحضور"
   },
   "texte": {
    "fr": "Appelez l’hôpital de jour le plus tôt possible pour avoir une nouvelle date. N’attendez pas le rendez-vous suivant.",
    "ar": "اتصلوا بمستشفى النهار في أقرب وقت لتحديد موعد جديد. لا تنتظروا الموعد التالي."
   },
   "tel": {
    "fr": "Téléphone de l’hôpital de jour",
    "ar": "هاتف مستشفى النهار"
   }
  },
  "retro": {
   "titre": {
    "fr": "Mes traitements antérieurs",
    "ar": "علاجاتي السابقة"
   },
   "medicament": {
    "fr": "Nom du médicament",
    "ar": "اسم الدواء"
   },
   "periode": {
    "fr": "Période",
    "ar": "الفترة"
   },
   "nbSeances": {
    "fr": "Nombre de séances",
    "ar": "عدد الحصص"
   },
   "arret": {
    "fr": "Motif d’arrêt",
    "ar": "سبب التوقف"
   }
  }
 },
 "p3": {
  "titre": {
   "fr": "Mes examens à faire",
   "ar": "فحوصاتي المطلوبة"
  },
  "intro": {
   "fr": "Ces examens vérifient que le traitement marche et qu’il est bien toléré. Faites-les même si vous allez bien, puis apportez les résultats.",
   "ar": "هذه الفحوصات تتحقق من أن العلاج فعّال وأن الجسم يتحمله جيدًا. أجروها حتى إذا كنتم بخير، ثم أحضروا النتائج."
  },
  "cols": {
   "examen": {
    "fr": "Examen",
    "ar": "الفحص"
   },
   "quand": {
    "fr": "À faire vers le",
    "ar": "تُجرى في حدود تاريخ"
   },
   "fait": {
    "fr": "Fait le",
    "ar": "أُجري بتاريخ"
   },
   "coche": {
    "fr": "Fait",
    "ar": "تمّ"
   },
   "resultatVu": {
    "fr": "Résultat vu par le médecin",
    "ar": "اطّلع الطبيب على النتيجة"
   },
   "visa": {
    "fr": "Signature / cachet",
    "ar": "التوقيع / الختم"
   }
  },
  "examens": {
   "biostd": {
    "fr": "Prise de sang (bilan habituel)",
    "ar": "تحليل الدم (التحاليل المعتادة)"
   },
   "nfs": {
    "fr": "Prise de sang : globules (NFS)",
    "ar": "تحليل الدم: كريات الدم (NFS)"
   },
   "crp": {
    "fr": "Prise de sang : inflammation (CRP)",
    "ar": "تحليل الدم: الالتهاب (CRP)"
   },
   "calpro": {
    "fr": "Analyse des selles (calprotectine)",
    "ar": "تحليل البراز (الكالبروتكتين)"
   },
   "tdm": {
    "fr": "Prise de sang : taux du médicament (juste avant la perfusion ou l’injection)",
    "ar": "تحليل الدم: نسبة الدواء في الدم (قبل التسريب أو الحقنة مباشرة)"
   },
   "actnf": {
    "fr": "Prise de sang : anticorps contre le médicament",
    "ar": "تحليل الدم: الأجسام المضادة للدواء"
   },
   "vit": {
    "fr": "Prise de sang : vitamine D",
    "ar": "تحليل الدم: فيتامين D"
   },
   "lip": {
    "fr": "Prise de sang : cholestérol",
    "ar": "تحليل الدم: الكوليسترول"
   },
   "colo": {
    "fr": "Coloscopie",
    "ar": "تنظير القولون"
   },
   "fibro": {
    "fr": "Fibroscopie de l’estomac",
    "ar": "تنظير المعدة"
   },
   "recto": {
    "fr": "Rectoscopie (examen du rectum)",
    "ar": "تنظير المستقيم (فحص المستقيم)"
   },
   "irm": {
    "fr": "IRM de l’intestin (entéro-IRM)",
    "ar": "الرنين المغناطيسي للأمعاء (IRM)"
   },
   "echo": {
    "fr": "Échographie du ventre",
    "ar": "الفحص بالصدى للبطن (الإيكوغرافيا)"
   },
   "rxt": {
    "fr": "Radio des poumons",
    "ar": "صورة أشعة للرئتين"
   },
   "igra": {
    "fr": "Test de la tuberculose (QuantiFERON, prise de sang)",
    "ar": "اختبار السل (QuantiFERON) بتحليل الدم"
   },
   "sero": {
    "fr": "Prise de sang : hépatites B et C, VIH (sérologies)",
    "ar": "تحليل الدم: التهاب الكبد الفيروسي B و\u00A0C، وفيروس نقص المناعة (VIH)"
   },
   "prebio": {
    "fr": "Bilan avant le début du traitement",
    "ar": "فحوصات ما قبل بداية العلاج"
   },
   "frottis": {
    "fr": "Frottis du col de l’utérus (gynécologue)",
    "ar": "مسحة عنق الرحم (عند طبيب أو طبيبة النساء)"
   },
   "peau": {
    "fr": "Examen de la peau (dermatologue)",
    "ar": "فحص الجلد (عند طبيب الجلد)"
   },
   "vacc": {
    "fr": "Vaccins à jour (grippe chaque automne)",
    "ar": "تحديث اللقاحات (الإنفلونزا كل خريف)"
   },
   "foie": {
    "fr": "Prise de sang : foie (transaminases)",
    "ar": "تحليل الدم: الكبد (الترانساميناز)"
   },
   "reins": {
    "fr": "Prise de sang : reins (créatinine)",
    "ar": "تحليل الدم: الكلى (الكرياتينين)"
   },
   "autre": {
    "fr": "Autre examen : ………",
    "ar": "فحص آخر: ………"
   }
  },
  "conseils": {
   "titre": {
    "fr": "Conseils",
    "ar": "نصائح"
   },
   "items": [
    {
     "fr": "Prise de sang pour le taux du médicament : juste avant la perfusion ou l’injection, pas après.",
     "ar": "تحليل الدم لقياس مستوى الدواء في الدم: قبل التسريب أو الحقنة مباشرة، وليس بعدها.",
     "p": 1
    },
    {
     "fr": "Analyse des selles (calprotectine) : suivez la feuille du laboratoire ; apportez le pot vite, sans le laisser au soleil.",
     "ar": "تحليل البراز (الكالبروتكتين): اتبعوا ورقة المختبر؛ أحضروا العلبة بسرعة، دون تركها في الشمس.",
     "p": 2
    },
    {
     "fr": "Coloscopie : suivez bien la préparation (régime, produit à boire). Demandez à l’avance si vous devez arrêter un médicament (fer, médicament qui fluidifie le sang…).",
     "ar": "تنظير القولون: اتبعوا التحضير جيدًا (الحمية، والمحلول الذي يُشرب). اسألوا مسبقًا إن كان يجب إيقاف دواء ما (الحديد، أدوية تمييع الدم…).",
     "p": 3
    },
    {
     "fr": "Rapportez tous les résultats et les comptes rendus à l’hôpital de jour.",
     "ar": "أحضروا كل النتائج والتقارير الطبية إلى مستشفى النهار.",
     "p": 1
    }
   ]
  },
  "rdv": {
   "titre": {
    "fr": "Mon prochain rendez-vous avec le médecin",
    "ar": "موعدي القادم مع الطبيب"
   },
   "titreCourt": {
    "fr": "Mon prochain rendez-vous",
    "ar": "موعدي القادم"
   },
   "cols": {
    "date": {
     "fr": "Date",
     "ar": "التاريخ"
    },
    "heure": {
     "fr": "Heure",
     "ar": "الساعة"
    },
    "quoi": {
     "fr": "Quoi",
     "ar": "نوع الموعد"
    },
    "lieu": {
     "fr": "Lieu",
     "ar": "المكان"
    },
    "fait": {
     "fr": "Fait",
     "ar": "تمّ"
    }
   },
   "quoi": {
    "consultation": {
     "fr": "Consultation",
     "ar": "استشارة طبية"
    },
    "perfusion": {
     "fr": "Perfusion",
     "ar": "تسريب وريدي"
    },
    "priseDeSang": {
     "fr": "Prise de sang",
     "ar": "تحليل الدم"
    },
    "perfusionHDJ": {
     "fr": "Perfusion — hôpital de jour",
     "ar": "تسريب وريدي — مستشفى النهار"
    }
   }
  },
  "versoCarte": {
   "fr": "Verso de ma carte",
   "ar": "ظهر بطاقتي"
  },
  "questions": {
   "titre": {
    "fr": "Mes questions pour le médecin",
    "ar": "أسئلتي للطبيب"
   },
   "texte": {
    "fr": "Écrivez vos questions ici avant le rendez-vous.",
    "ar": "اكتبوا أسئلتكم هنا قبل الموعد."
   }
  }
 },
 "p4": {
  "titre": {
   "fr": "Urgences et conseils",
   "ar": "المستعجلات والنصائح"
  },
  "rouge": {
   "titre": {
    "fr": "URGENCES : allez aux urgences ou appelez une ambulance",
    "ar": "حالة مستعجلة: توجهوا إلى المستعجلات أو اطلبوا سيارة إسعاف"
   },
   "sousTitre": {
    "fr": "Urgences du CHU (24 h/24) : {settings.telUrgences} · SAMU : 141 · Protection civile (ambulance) : 15",
    "ar": "مستعجلات المستشفى الجامعي (24/24): {settings.telUrgences} · الإسعاف الطبي (SAMU): \u2066141\u2069 · الوقاية المدنية (سيارة إسعاف): \u206615\u2069"
   },
   "items": [
    {
     "fr": "Gêne pour respirer, gonflement du visage ou de la gorge",
     "ar": "صعوبة في التنفس، تورّم في الوجه أو الحلق",
     "p": 1
    },
    {
     "fr": "Douleur dans la poitrine, essoufflement brutal, ou jambe gonflée, rouge et douloureuse (caillot)",
     "ar": "ألم في الصدر، أو ضيق مفاجئ في التنفس، أو ساق متورمة وحمراء ومؤلمة (جلطة)",
     "p": 1
    },
    {
     "fr": "Beaucoup de sang dans les selles (ou plus de 6 fois par jour), caillots, malaise",
     "ar": "دم كثير في البراز (أو أكثر من 6 مرات في اليوم)، كتل دموية، إحساس بالإغماء",
     "p": 1
    },
    {
     "fr": "Ventre très douloureux, gonflé, dur, plus de gaz ni selles",
     "ar": "بطن مؤلم جدًا ومنتفخ وصلب، توقف الغازات والبراز",
     "p": 1
    },
    {
     "fr": "Vomissements répétés : impossible de boire",
     "ar": "قيء متكرر: لا تستطيعون الشرب",
     "p": 1
    },
    {
     "fr": "Fièvre avec frissons forts, grande faiblesse ou somnolence",
     "ar": "حمى مع قشعريرة قوية، ضعف شديد أو نعاس غير عادي",
     "p": 1
    },
    {
     "fr": "Faiblesse d’un côté du corps, bouche déviée, parole difficile",
     "ar": "ضعف في جهة من الجسم، اعوجاج الفم، صعوبة في الكلام",
     "p": 2
    }
   ]
  },
  "orange": {
   "titre": {
    "fr": "Appelez l’hôpital de jour le jour même",
    "ar": "اتصلوا بمستشفى النهار في نفس اليوم"
   },
   "items": [
    {
     "fr": "Fièvre à 38 °C ou plus, ou frissons",
     "ar": "حمى 38 درجة أو أكثر، أو قشعريرة",
     "p": 1
    },
    {
     "fr": "Brûlures en urinant, plaie rouge, dent qui fait mal",
     "ar": "حرقة عند التبول، جرح أحمر، ألم في الأسنان",
     "p": 1
    },
    {
     "fr": "Toux avec crachats, ou toux qui dure, sueurs la nuit, perte de poids",
     "ar": "سعال مع بلغم، أو سعال يدوم، تعرّق في الليل، نقص في الوزن",
     "p": 1
    },
    {
     "fr": "Zona (boutons douloureux en bande) ou herpès",
     "ar": "الحزام الناري (حبوب مؤلمة على شكل شريط) أو الهربس",
     "p": 2
    },
    {
     "fr": "Après la perfusion ou l’injection : boutons, démangeaisons, douleurs des articulations",
     "ar": "بعد التسريب أو الحقنة: حبوب، حكة، ألم في المفاصل",
     "si": {
      "voie": [
       "IV",
       "SC"
      ]
     },
     "p": 2
    },
    {
     "fr": "Point d’injection rouge, qui grandit ou dure plus de 2 jours",
     "ar": "مكان الحقن أحمر، يكبر أو يدوم أكثر من يومين",
     "si": {
      "voie": "SC"
     },
     "p": 1
    },
    {
     "fr": "Plus de selles, de sang ou de douleurs depuis 2 à 3 jours",
     "ar": "زيادة في التبرز أو الدم أو الألم منذ 2 إلى 3 أيام",
     "p": 1
    },
    {
     "fr": "Je suis enceinte ou je pense l’être",
     "ar": "أنا حامل أو أظن أنني حامل",
     "si": {
      "classe": [
       "antiTNF",
       "vedolizumab",
       "antiIL"
      ],
      "sexe": "F"
     },
     "p": 1
    },
    {
     "fr": "Je suis enceinte ou je pense l’être : appelez tout de suite, ce médicament ne doit pas être pris pendant la grossesse",
     "ar": "أنا حامل أو أظن أنني حامل: اتصلي فورًا، لأن هذا الدواء يجب ألّا يؤخذ أثناء الحمل",
     "si": {
      "classe": "JAK",
      "sexe": "F"
     },
     "p": 1
    },
    {
     "fr": "Je suis enceinte ou je pense l’être et je prends du méthotrexate : appelez tout de suite",
     "ar": "أنا حامل أو أظن أنني حامل وآخذ دواء Méthotrexate (ميثوتريكسات): اتصلي فورًا",
     "si": {
      "associe": "methotrexate",
      "sexe": "F"
     },
     "p": 1
    },
    {
     "fr": "Un autre médecin me propose : antibiotique, cortisone, vaccin, opération",
     "ar": "طبيب آخر يقترح عليّ: مضاد حيوي، كورتيزون، لقاح، عملية جراحية",
     "p": 1
    },
    {
     "fr": "J’ai oublié une injection, une perfusion ou plusieurs comprimés",
     "ar": "نسيت حقنة أو تسريبًا أو عدة أقراص",
     "p": 1
    },
    {
     "fr": "Yeux ou peau jaunes, urines très foncées",
     "ar": "اصفرار العينين أو الجلد، بول داكن جدًا",
     "p": 2
    },
    {
     "fr": "Contact avec un malade : tuberculose, varicelle, zona",
     "ar": "مخالطة مريض بالسل أو جدري الماء أو الحزام الناري",
     "p": 2
    }
   ]
  },
  "jamais": {
   "titre": {
    "fr": "À ne jamais faire",
    "ar": "ممنوع تمامًا"
   },
   "items": [
    {
     "fr": "Arrêter ou décaler mon traitement sans avis",
     "ar": "إيقاف علاجي أو تأجيله دون استشارة",
     "p": 1
    },
    {
     "fr": "Un vaccin vivant : fièvre jaune, ROR, BCG, varicelle",
     "ar": "لقاح حيّ: الحمى الصفراء، الحصبة (ROR)، السل (BCG)، جدري الماء",
     "p": 1
    },
    {
     "fr": "Anti-inflammatoires (ibuprofène…), cortisone sans avis",
     "ar": "مضادات الالتهاب مثل Ibuprofène (إيبوبروفين)، أو كورتيزون، دون استشارة",
     "p": 1
    },
    {
     "fr": "Prendre 2 doses pour rattraper un oubli",
     "ar": "أخذ جرعتين لتعويض جرعة منسية",
     "p": 1
    },
    {
     "fr": "Cacher ma biothérapie au dentiste, chirurgien, pharmacien",
     "ar": "إخفاء علاجي البيولوجي عن طبيب الأسنان والجرّاح والصيدلي",
     "p": 1
    },
    {
     "fr": "Plantes, remèdes traditionnels, hijama sans demander",
     "ar": "الأعشاب، الوصفات التقليدية، الحجامة دون استشارة",
     "p": 2
    }
   ]
  },
  "avant": {
   "titre": {
    "fr": "Avant chaque séance, 5 questions — je coche si « oui »",
    "ar": "قبل كل حصة، 5 أسئلة — أضع علامة إذا كان الجواب « نعم »"
   },
   "titreCourt": {
    "fr": "Avant chaque séance, je coche si « oui »",
    "ar": "قبل كل حصة، أضع علامة إذا كان الجواب « نعم »"
   },
   "titreParVoie": {
    "SC": {
     "fr": "Avant chaque séance ou injection, 5 questions — je coche si « oui »",
     "ar": "قبل كل حصة أو حقنة، 5 أسئلة — أضع علامة إذا كان الجواب « نعم »"
    },
    "PO": {
     "fr": "Avant de continuer mes comprimés, 5 questions — je coche si « oui »",
     "ar": "قبل أن أستمر في أقراصي، 5 أسئلة — أضع علامة إذا كان الجواب « نعم »"
    }
   },
   "items": [
    {
     "fr": "☐ Fièvre ces derniers jours ?",
     "ar": "حمى في الأيام الأخيرة؟",
     "p": 1
    },
    {
     "fr": "☐ Infection : toux, brûlures en urinant, plaie, dent ?",
     "ar": "عدوى: سعال، حرقة عند التبول، جرح، سن؟",
     "p": 1
    },
    {
     "fr": "☐ Antibiotique, vaccin ou nouveau médicament ?",
     "ar": "مضاد حيوي، لقاح أو دواء جديد؟",
     "p": 1
    },
    {
     "fr": "☐ Grossesse ou projet de bébé ?",
     "ar": "حمل أو رغبة في الإنجاب؟",
     "p": 1,
     "si": {
      "sexe": "F"
     }
    },
    {
     "fr": "☐ Opération ou soin dentaire prévu ?",
     "ar": "عملية أو علاج أسنان مبرمج؟",
     "p": 1
    },
    {
     "fr": "Une case cochée → appelez AVANT de venir. La séance peut être décalée : c’est normal.",
     "ar": "خانة معلّمة ← اتصلوا قبل المجيء. قد تُؤجَّل الحصة: هذا أمر عادي.",
     "p": 1,
     "texte": true
    },
    {
     "fr": "Pendant la perfusion : démangeaisons, gêne pour respirer, frissons → appelez l’infirmier(ère)",
     "ar": "أثناء التسريب: حكة، صعوبة في التنفس، قشعريرة ← نادوا الممرض(ة)",
     "si": {
      "voie": "IV"
     },
     "p": 2,
     "texte": true
    }
   ]
  },
  "numeros": {
   "titre": {
    "fr": "Numéros utiles",
    "ar": "أرقام مفيدة"
   },
   "items": [
    {
     "fr": "Ma pharmacie",
     "ar": "صيدليتي",
     "p": 1
    },
    {
     "fr": "Mon médecin de famille",
     "ar": "طبيب الأسرة",
     "p": 1
    },
    {
     "fr": "Autre (laboratoire, assistante sociale…)",
     "ar": "آخر (المختبر، المساعدة الاجتماعية…)",
     "p": 2
    }
   ]
  },
  "notes": {
   "fr": "Notes",
   "ar": "ملاحظات"
  },
  "hdj": {
   "fr": "Hôpital de jour",
   "ar": "مستشفى النهار"
  },
  "sinonUrgences": {
   "fr": "sinon : urgences",
   "ar": "وإلا: المستعجلات"
  },
  "marque": {
   "fr": "marque",
   "ar": "العلامة"
  },
  "carte": {
   "titreLong": {
    "fr": "Ma carte (à découper et à garder sur moi)",
    "ar": "بطاقتي (أقصّها وأحملها معي دائمًا)"
   },
   "recto": {
    "titre": {
     "fr": "Je suis sous biothérapie",
     "ar": "أتلقى علاجًا بيولوجيًا"
    },
    "items": [
     {
      "fr": "Traitement",
      "ar": "العلاج",
      "p": 1
     },
     {
      "fr": "Ce traitement diminue mes défenses contre les infections.",
      "ar": "هذا العلاج يُضعف مناعتي ضد العدوى.",
      "p": 1
     },
     {
      "fr": "Fièvre ou urgence : prévenez l’hôpital de jour.",
      "ar": "حمى أو حالة مستعجلة: أخبروا مستشفى النهار.",
      "p": 1
     },
     {
      "fr": "Pas de vaccin vivant. Pas d’anti-inflammatoires sans avis.",
      "ar": "ممنوع أي لقاح حيّ. لا مضادات التهاب دون استشارة.",
      "p": 1
     },
     {
      "fr": "Hôpital de jour",
      "ar": "مستشفى النهار",
      "p": 1
     },
     {
      "fr": "Urgences (24 h/24)",
      "ar": "المستعجلات (24/24)",
      "p": 1
     }
    ]
   },
   "verso": {
    "items": [
     {
      "fr": "Nom et prénom",
      "ar": "الاسم الكامل",
      "p": 1
     },
     {
      "fr": "N° de dossier",
      "ar": "رقم الملف",
      "p": 1
     },
     {
      "fr": "Maladie",
      "ar": "المرض",
      "p": 1
     },
     {
      "fr": "Traitement depuis le",
      "ar": "بداية العلاج",
      "p": 2
     },
     {
      "fr": "Médecin",
      "ar": "الطبيب",
      "p": 2
     },
     {
      "fr": "Gardez cette carte sur vous pendant le traitement et au moins 4 mois après la dernière dose.",
      "ar": "احتفظوا بهذه البطاقة معكم طوال العلاج ولمدة 4 أشهر على الأقل بعد آخر جرعة.",
      "p": 2
     }
    ]
   }
  },
  "pied": {
   "avis": {
    "fr": "Ce carnet ne remplace pas l’avis de votre médecin. Au moindre doute, appelez l’hôpital de jour.",
    "ar": "هذا الدفتر لا يعوّض رأي طبيبكم. عند أدنى شك، اتصلوا بمستشفى النهار."
   },
   "maquette": {
    "fr": "MAQUETTE — contenu à valider par l’équipe médicale avant toute utilisation",
    "ar": "نموذج أولي — يجب أن يراجع الفريق الطبي هذا المحتوى قبل أي استعمال"
   }
  }
 },
 "translit": {
  "infliximab": "إنفليكسيماب",
  "adalimumab": "أداليموماب",
  "golimumab": "غوليموماب",
  "vedolizumab": "فيدوليزوماب",
  "ustekinumab": "أوستيكينوماب",
  "risankizumab": "ريسانكيزوماب",
  "mirikizumab": "ميريكيزوماب",
  "upadacitinib": "أوباداسيتينيب",
  "tofacitinib": "توفاسيتينيب",
  "azathioprine": "آزاثيوبرين",
  "mesalazine": "ميسالازين",
  "methotrexate": "ميثوتريكسات",
  "paracetamol": "باراسيتامول",
  "ibuprofene": "إيبوبروفين",
  "diclofenac": "ديكلوفيناك",
  "ketoprofene": "كيتوبروفين",
  "naproxene": "نابروكسين",
  "loperamide": "لوبيراميد",
  "guselkumab": "غوسيلكوماب",
  "allopurinol": "ألوبورينول"
 },
 "suite": {
  "fr": "(suite)",
  "ar": "(تتمة)"
 },
 "_nouvelles": [
  {
   "cle": "p1.sexe.fille",
   "fr": "Fille",
   "ar": "أنثى"
  },
  {
   "cle": "p1.sexe.garcon",
   "fr": "Garçon",
   "ar": "ذكر"
  },
  {
   "cle": "p1.ecole",
   "fr": "École (classe)",
   "ar": "المدرسة (القسم)"
  },
  {
   "cle": "p1.parents.titre",
   "fr": "Mes parents ou mon tuteur (à prévenir)",
   "ar": "والداي أو وليّ أمري (يُتَّصل بهم عند الحاجة)"
  },
  {
   "cle": "p1.parents.lien",
   "fr": "Lien (père, mère, tuteur…)",
   "ar": "صلته بي (أب، أم، وصيّ…)"
  },
  {
   "cle": "p1.parents.autreTel",
   "fr": "Autre téléphone",
   "ar": "هاتف آخر"
  },
  {
   "cle": "p2.retro.titre",
   "fr": "Mes traitements antérieurs",
   "ar": "علاجاتي السابقة"
  },
  {
   "cle": "p2.retro.periode",
   "fr": "Période",
   "ar": "الفترة"
  },
  {
   "cle": "p2.retro.nbSeances",
   "fr": "Nombre de séances",
   "ar": "عدد الحصص"
  },
  {
   "cle": "p2.retro.arret",
   "fr": "Motif d’arrêt",
   "ar": "سبب التوقف"
  },
  {
   "cle": "suite",
   "fr": "(suite)",
   "ar": "(تتمة)"
  },
  {
   "cle": "p1.rythme.semaines.un",
   "fr": "Toutes les semaines",
   "ar": "كل أسبوع"
  },
  {
   "cle": "p1.rythme.semaines.deux",
   "fr": "Toutes les 2 semaines",
   "ar": "كل أسبوعين"
  },
  {
   "cle": "p1.rythme.semaines.beaucoup",
   "fr": "Toutes les {n} semaines",
   "ar": "كل {n} أسبوعًا"
  },
  {
   "cle": "p1.rythme.jours.un",
   "fr": "Tous les jours",
   "ar": "كل يوم"
  },
  {
   "cle": "p1.rythme.jours.deux",
   "fr": "Tous les 2 jours",
   "ar": "كل يومين"
  },
  {
   "cle": "p1.rythme.jours.peu",
   "fr": "Tous les {n} jours",
   "ar": "كل {n} أيام"
  },
  {
   "cle": "p1.rythme.jours.beaucoup",
   "fr": "Tous les {n} jours",
   "ar": "كل {n} يومًا"
  },
  {
   "cle": "p1.rythme.po1",
   "fr": "1 fois par jour",
   "ar": "مرة واحدة في اليوم"
  },
  {
   "cle": "p1.rythme.po2",
   "fr": "2 fois par jour",
   "ar": "مرتين في اليوم"
  },
  {
   "cle": "p1.heures.un",
   "fr": "Environ 1 heure",
   "ar": "حوالي ساعة واحدة"
  },
  {
   "cle": "p1.heures.deux",
   "fr": "Environ 2 heures",
   "ar": "حوالي ساعتين"
  },
  {
   "cle": "p1.heures.beaucoup",
   "fr": "Environ {n} heures",
   "ar": "حوالي {n} ساعة"
  },
  {
   "cle": "p1.horairesListe",
   "fr": "Le {jours}, de {h1} à {h2}",
   "ar": "يوم {jours}، من {h1} إلى {h2}"
  },
  {
   "cle": "p1.jours.1",
   "fr": "lundi",
   "ar": "الاثنين"
  },
  {
   "cle": "p1.jours.2",
   "fr": "mardi",
   "ar": "الثلاثاء"
  },
  {
   "cle": "p1.jours.3",
   "fr": "mercredi",
   "ar": "الأربعاء"
  },
  {
   "cle": "p1.jours.4",
   "fr": "jeudi",
   "ar": "الخميس"
  },
  {
   "cle": "p1.jours.5",
   "fr": "vendredi",
   "ar": "الجمعة"
  },
  {
   "cle": "p1.jours.6",
   "fr": "samedi",
   "ar": "السبت"
  },
  {
   "cle": "p1.jours.0",
   "fr": "dimanche",
   "ar": "الأحد"
  }
 ]
};
