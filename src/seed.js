import { getDb, createSentence } from './db.js';

getDb();

const defaultSentences = [
  { hitokoto: '用代码表达言语的魅力，用代码书写山河的壮丽。', type: '网络', from_source: '一言开发者中心', from_who: '一言' },
  { hitokoto: '我们不写代码，我们只是自然语言的搬运工。', type: '原创', from_source: '强哥语录', from_who: '强哥' },
  { hitokoto: '生活就像骑绿道，上坡累成狗，下坡爽翻天。', type: '原创', from_source: '骑行日记', from_who: '强哥' },
  { hitokoto: '路漫漫其修远兮，吾将上下而求索。', type: '诗词', from_source: '离骚', from_who: '屈原' },
  { hitokoto: '世界上只有一种真正的英雄主义，那就是在认清生活真相之后依然热爱生活。', type: '文学', from_source: '名人传记', from_who: '罗曼·罗兰' },
  { hitokoto: '把握生命里的每一分钟，全力以赴我们心中的梦。', type: '影视', from_source: '《真心英雄》', from_who: '周华健' },
  { hitokoto: '人如果没有梦想，那和咸鱼有什么区别。', type: '影视', from_source: '《少林足球》', from_who: '周星驰' },
  { hitokoto: '有些路很远，走下去会很累，可是不走，会后悔。', type: '网络', from_source: '网络', from_who: '' },
  { hitokoto: '编程最重要的是实践，不是理论。', type: '原创', from_source: '强哥的思考', from_who: '强哥' },
  { hitokoto: '人生就像一场马拉松，关键不是瞬间的爆发，而是途中的坚持。', type: '网络', from_source: '网络', from_who: '' },
];

const { getStats } = await import('./db.js');
const stats = getStats();
if (stats.total === 0) {
  for (const s of defaultSentences) {
    createSentence(s);
  }
  console.log(`✅ Inserted ${defaultSentences.length} default sentences`);
} else {
  console.log(`ℹ️ DB already has ${stats.total} records, skipping seed`);
}
console.log(`📊 DB path: data/hitokoto.db`);
