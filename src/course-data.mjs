const schedule = (day, start, end, label) => ({ day, start, end, label });

export const courses = [
  {
    id: 'ai-practical-project', title: '人工智慧實務專題', credits: 3, sectionCode: '783006001',
    teacher: '魏綾音', available: true, required: false, schedule: null, asyncAllowed: false,
    minYear: 3, conditions: ['時間與地點另依教學大綱公告', '建議具程式設計與機器學習基礎', '大一、大二須經教師同意加簽'],
    sections: ['070395001｜時間未定｜EMI', '070395011｜週六 09:10–12:00', '783006001｜人智學程｜時間未定'],
    variants: [
      {
        id: '783006001', label: '783006001｜AI 學程', sectionCode: '783006001', teacher: '魏綾音',
        schedule: null, optionMessage: '115-1 上課時間尚未公告',
      },
      {
        id: '070395001', label: '070395001｜AI 中心三位老師合開', sectionCode: '070395001',
        teacher: '吳怡潔、吳致勳、陳昭伶', schedule: null,
        advisors: [
          {
            id: 'chen-chao-ling', teacher: '陳昭伶', schedule: null,
            location: '依小組另行約定', optionMessage: '小組彈性約定，實體會議通常安排於中午',
          },
          {
            id: 'wu-chih-hsun', teacher: '吳致勳', location: '行大 8F 160812',
            schedule: schedule(2, 790, 960, '週二 D56'),
          },
          {
            id: 'wu-yi-chieh', teacher: '吳怡潔', location: '電算中心智慧教室 140011',
            schedule: schedule(3, 790, 960, '週三 D56'),
          },
        ],
      },
    ],
  },
  {
    id: 'digital-marketing', title: '數位行銷實作研習', credits: 3, sectionCode: '305677001',
    teacher: '樓永堅', available: true, required: false, schedule: schedule(3, 1110, 1280, '週三 18:30–21:20'),
    asyncAllowed: false, conditions: ['供應鏈學程／創新創業學程', '另有商院碩士班課號 300743001'],
    sections: ['305677001｜學士班', '300743001｜碩士班'],
  },
  {
    id: 'agentic-ai', title: 'Agentic AI 在金融領域的應用', credits: 3, sectionCode: '300723001',
    teacher: '吳文舜、蔡瑞煌', available: true, required: true, schedule: schedule(4, 790, 960, '週四 13:10–16:00'),
    asyncAllowed: false, minYear: 3, programs: ['innovation'], conditions: ['創新創業學程大三以上', '選課方式：分派', '商館 260306'],
    sections: ['300723001｜創新創業學程', '306715001｜資管大三、大四｜25 人', '356339001｜資管碩士班'],
  },
  {
    id: 'digital-salon', title: '數位創新沙龍', credits: 2, sectionCode: '300734001',
    teacher: '張欣綠', available: true, required: true, schedule: schedule(5, 790, 960, '週五 13:10–16:00'),
    asyncAllowed: false, minYear: 3, programs: ['innovation'], conditions: ['創新創業學程大三、大四', '選課方式：分派', '商館 260102'],
    sections: ['300734001｜創新創業學程', '306738001｜資管大四優先', '356392001｜資管碩士班'],
  },
  {
    id: 'entrepreneur', title: '尋找心中的創業家', credits: 3, sectionCode: '300722001',
    teacher: '羅文倩', available: true, required: false, schedule: schedule(3, 550, 720, '週三 09:10–12:00'),
    asyncAllowed: false, programs: ['innovation'], conditions: ['第一階段僅供創新創業學程選讀', '有名額時再釋出'],
    sections: ['300722001｜商院學士', '402111001｜廣告三、四', 'ZC0936001｜X 實驗學士'],
  },
  {
    id: 'creative-intro', title: '創創入門', credits: 3, sectionCode: '305776001',
    teacher: '陳冠儒', available: true, required: true, schedule: schedule(4, 1090, 1260, '週四 18:10–21:00'),
    asyncAllowed: false, conditions: ['全報名制，不開放自行選課', '選課方式：分派', '商館 260210'],
    sections: ['305776001｜學士班', '300725001｜商院碩士班'],
  },
  {
    id: 'human-interaction', title: '人機互動', credits: 3, sectionCode: '703055001',
    teacher: '廖文宏', available: true, required: false, schedule: schedule(4, 550, 720, '週四 09:10–12:00'),
    asyncAllowed: false, minYear: 3, presets: ['concentrated', 'lighter'], conditions: ['資訊三、四', '112／113 級群 C 課程'],
    sections: ['703055001｜學士班', '753846001｜碩士班'],
  },
  {
    id: 'social-mining', title: '社群媒體探勘', credits: 3, sectionCode: '783010001',
    teacher: '郭正佩', available: true, required: false, schedule: schedule(1, 970, 1140, '週一 16:10–19:00'),
    asyncAllowed: false, presets: ['concentrated', 'async-first'], conditions: ['人智學程群修'], sections: ['783010001｜學士班'],
  },
  {
    id: 'bioinformatics', title: '生物資訊概論與實務', credits: 3, sectionCode: '703815001',
    teacher: '張家銘', available: true, required: false, schedule: schedule(4, 550, 720, '週四 09:10–12:00'),
    asyncAllowed: false, minYear: 3, conditions: ['資訊三、四', 'EMI 課程'], sections: ['703815001｜學士班', '753845001｜碩士班'],
  },
  {
    id: 'ai-images', title: '人工智慧生成圖像與創造力', credits: 3, sectionCode: '070399001',
    teacher: '李怡志', available: true, required: false, schedule: schedule(2, 550, 720, '週二 09:10–12:00'),
    asyncAllowed: false, conditions: ['可能需自費訂閱生成式 AI 服務'], sections: ['070399001｜學士班'],
  },
  {
    id: 'fintech-intro', title: '金融科技導論', credits: 3, sectionCode: '070424001',
    teacher: '張智星', available: true, required: false, schedule: schedule(3, 550, 730, '週三 09:10–12:10'),
    asyncAllowed: true, level: 'graduate', undergradReview: true,
    conditions: ['課綱允許非同步觀看', '不開放加簽', '碩士班性質，學士生須確認資格與學分認列', '難度 6／10'],
    events: [{ label: '實體期末考', date: '2026-12-23', day: 3, start: 550, end: 730 }], sections: ['070424001｜TAICA 主導課程'],
  },
  {
    id: 'management-science', title: '管理科學', credits: 3, sectionCode: '305049001',
    teacher: '陳立民', available: true, required: false, schedule: schedule(5, 550, 720, '週五 09:10–12:00'),
    asyncAllowed: false, conditions: ['企管一甲、乙必修', 'EMI 課程，外系選修資格需確認'], sections: ['305049001｜學士班'],
  },
  {
    id: 'financial-engineering', title: '財務工程及金融創新', credits: 3, sectionCode: '352062001',
    teacher: '林士貴', available: true, required: false, schedule: schedule(4, 550, 720, '週四 09:10–12:00'),
    asyncAllowed: false, level: 'graduate', conditions: ['僅碩、博士班', '金融所優先', '財工與金融科技組必修'],
    sections: ['352062001｜金融碩博', '751797001｜應數碩博'],
  },
  {
    id: 'business-analytics', title: '商業分析：SAS／R 應用', credits: 3, sectionCode: '300008001',
    teacher: '周珮婷', available: true, required: false, schedule: schedule(5, 550, 720, '週五 09:10–12:00'),
    asyncAllowed: false, minYear: 3, prerequisites: ['statistics'], conditions: ['限大三以上', '須修過統計學 3 學分', '商學院共同群修'], sections: ['300008001｜學士班'],
  },
  {
    id: 'ml-intro', title: '機器學習概論', credits: 3, sectionCode: '703901001',
    teacher: '劉昭麟', available: true, required: false, schedule: schedule(1, 790, 960, '週一 13:10–16:00'),
    asyncAllowed: false, minYear: 3, presets: ['concentrated', 'async-first', 'lighter'], conditions: ['資訊三、四', '112／113 級群 B 課程'],
    sections: ['703901001｜學士班', '753934001｜碩士班', '971879001｜週四晚間專班'],
  },
  {
    id: 'business-data-science', title: '資料科學的商業應用', credits: 3, sectionCode: '306723001',
    teacher: '向倩儀', available: true, required: false, schedule: schedule(2, 550, 720, '週二 09:10–12:00'),
    asyncAllowed: false, minYear: 3, conditions: ['資管三、四', '不開加簽', '逸仙樓 0503 電腦教室'], sections: ['306723001｜學士班', '356358001｜碩士班'],
  },
  {
    id: 'information-visualization', title: '資訊視覺化', credits: 3, sectionCode: '703842001',
    teacher: '紀明德', available: true, required: false, schedule: schedule(2, 550, 720, '週二 09:10–12:00'),
    asyncAllowed: false, minYear: 3, conditions: ['資訊三、四', '112／113 級群 C 課程'],
    sections: ['703842001｜學士班', '753841001｜碩士班', '971872001｜週五晚間專班'],
  },
  {
    id: 'smart-hci', title: '智慧人機互動', credits: 3, sectionCode: '070426001',
    teacher: '韓秉軒', available: true, required: false, schedule: schedule(4, 790, 960, '週四 13:10–16:00'),
    asyncAllowed: true, level: 'graduate', openToUndergradYear: 3, presets: ['async-first'], presetAttendance: { 'async-first': 'async' },
    conditions: ['課綱允許非同步觀看', '開放大三以上', '不開放加簽', '難度 6／10'],
    events: [{ label: '共同成果展示', date: '2026-12-26', day: 6, start: 790, end: 960 }], sections: ['070426001｜TAICA 主導課程'],
  },
  {
    id: 'ai-intro', title: '人工智慧導論', credits: 3, sectionCode: '070423001',
    teacher: '朱威達', available: true, required: false, schedule: schedule(4, 790, 960, '週四 13:10–16:00'),
    asyncAllowed: true, conditions: ['課綱允許非同步觀看', '不開放加簽', '12／10 考試與必修 Agentic AI 衝突', '難度 4／10'],
    events: [{ label: '實體考試', date: '2026-12-10', day: 4, start: 790, end: 960 }], sections: ['070423001｜學士班／TAICA'],
  },
  {
    id: 'nlp', title: '自然語言處理', credits: 3, sectionCode: '070427001',
    teacher: '高宏宇', available: true, required: false, schedule: schedule(4, 540, 720, '週四 09:00–12:00'),
    asyncAllowed: true, level: 'graduate', openToUndergradYear: 3, conditions: ['課綱允許非同步觀看', '開放大三以上', '不開放加簽', '難度 8／10'],
    events: [{ label: '實體考試', date: '2026-12-10', day: 4, start: 540, end: 720 }], sections: ['070427001｜TAICA', '555758001｜語言所碩博'],
  },
  {
    id: 'computational-thinking', title: '計算思維與人工智慧應用導論', credits: 3, sectionCode: '070393001',
    teacher: '陳昭伶／吳致勳', available: true, required: false, schedule: schedule(5, 550, 720, '週五 09:10–12:00'),
    asyncAllowed: false, conditions: ['人工智慧跨域微學程', '另有週二 EMI 班與人智學程必修課號'],
    sections: ['070393001｜週五中文', '070393011｜週二 EMI', '783001001｜人智學程必修'],
  },
  {
    id: 'ai-methods', title: '人工智慧方法與工具', credits: 3, sectionCode: '070394021',
    teacher: '吳致勳', available: true, required: false, schedule: schedule(1, 790, 960, '週一 13:10–16:00'),
    asyncAllowed: false, conditions: ['人工智慧跨域微學程', '有週一、週三、週四三個班別'],
    sections: ['070394021｜週一中文', '070394011｜週三 EMI', '070394001｜週四中文'],
  },
  {
    id: 'blockchain', title: '區塊鏈與代幣經濟', credits: 3, sectionCode: '306719011',
    teacher: '莊豐源', available: true, required: false, schedule: schedule(4, 790, 960, '週四 13:10–16:00'),
    asyncAllowed: false, minYear: 3, conditions: ['資管三、四', '英文授課', '學碩合開，30 人'], sections: ['306719011｜學士班', '356344011｜碩士班'],
  },
  {
    id: 'applied-ml', title: '應用機器學習', credits: 0, sectionCode: '—', teacher: '—',
    available: false, required: false, schedule: null, asyncAllowed: false, conditions: ['115-1 查無開課資料'], sections: [],
  },
];

export const dayLabels = ['', '週一', '週二', '週三', '週四', '週五', '週六'];
