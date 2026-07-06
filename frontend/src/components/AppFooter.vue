<template>
  <footer class="footer" v-if="siteInfo && siteInfo.showCopyright !== false">
    <div class="footer-inner" style="max-width:1200px;margin:0 auto">
      <span v-if="siteInfo.siteUrl">
        <a :href="siteInfo.siteUrl" target="_blank" rel="noopener" class="footer-link">{{ siteInfo.siteName || '拾句' }}</a>
        <span v-if="siteInfo.year"> ｜ Copyright &copy; {{ siteInfo.year }}</span>
      </span>
      <template v-else>
        <span v-if="siteInfo.year">Copyright &copy; {{ siteInfo.year }}</span>
      </template>
      <span v-if="siteInfo.author"> ｜
        <a :href="authorUrl" target="_blank" rel="noopener" class="footer-link">{{ siteInfo.author }}</a>
      </span>
      <span v-if="siteInfo.icp"> ｜
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" class="footer-link">{{ siteInfo.icp }}</a>
      </span>
    </div>
  </footer>
</template>

<script>
export default {
  name: 'AppFooter',
  props: {
    siteInfo: { type: Object, default: () => ({}) }
  },
  computed: {
    authorUrl() {
      return this.siteInfo.authorUrl || 'https://guole.fun'
    }
  }
}
</script>
