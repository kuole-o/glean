import { getDb, createSentence, getStats } from './db.js';
import { getCategories } from './categories.js';
import { invalidateCache } from './cache.js';

(async () => {
  getDb();

// One curated sentence per known category. Keyed by category name so that
// `CATEGORIES` env overrides still line up — any category present here gets a
// hand-picked line, anything else falls back to a generic placeholder.
  const CURATED = {
    原创:   { content: '我们不写代码，我们只是自然语言的搬运工。', from_source: '佚名语录', from_who: '佚名' },
    动画:   { content: '曾经发生的事情不可能忘记，只是暂时想不起来而已。', from_source: '《千与千寻》', from_who: '钱婆婆' },
    歌词:   { content: '故事的小黄花，从出生那年就飘着。', from_source: '周杰伦《晴天》', from_who: '周杰伦' },
    游戏:   { content: '为了艾泽拉斯！', from_source: '《魔兽世界》', from_who: '' },
    文学:   { content: '世界上只有一种真正的英雄主义，那就是在认清生活真相之后依然热爱生活。', from_source: '《米开朗琪罗传》', from_who: '罗曼·罗兰' },
    网络:   { content: '有些路很远，走下去会很累，可是不走，会后悔。', from_source: '网络', from_who: '佚名' },
    影视:   { content: '人如果没有梦想，那和咸鱼有什么区别。', from_source: '《少林足球》', from_who: '周星驰' },
    诗词:   { content: '路漫漫其修远兮，吾将上下而求索。', from_source: '《离骚》', from_who: '屈原' },
    哲学:   { content: '人不能两次踏进同一条河流。', from_source: '古希腊哲学', from_who: '赫拉克利特' },
    抖机灵: { content: '生活就像骑绿道，上坡累成狗，下坡爽翻天。', from_source: '骑行日记', from_who: '佚名' },
    其他:   { content: '把握生命里的每一分钟，全力以赴我们心中的梦。', from_source: '《真心英雄》', from_who: '周华健' },
  };

  function sentenceFor(category) {
    const curated = CURATED[category];
    if (curated) return { type: category, ...curated };
    // Custom category with no curated line — insert a friendly placeholder.
    return {
      content: `这是「${category}」分类的示例句子，快来添加属于你的好句吧。`,
      type: category,
      from_source: '示例',
      from_who: '',
    };
  }

  const stats = getStats();
  if (stats.total === 0) {
    const categories = getCategories();
    for (const category of categories) {
      createSentence(sentenceFor(category));
    }
    console.log(`✅ Inserted ${categories.length} sample sentences (one per category)`);

    await invalidateCache();
    console.log('🗑️  Redis cache cleared');
  } else {
    console.log(`ℹ️ DB already has ${stats.total} records, skipping seed`);
  }
  console.log('📊 DB path: data/glean.db');

  process.exit(0);
})();