import { defineConfig } from 'vitepress';
import typedocSidebar from '../api/typedoc-sidebar.json';

export default defineConfig({
  base: '/bintastic/',
  title: 'bintastic',
  description: 'A test harness for Node.js CLI tools',
  cleanUrls: true,
  // Architecture decision records are for maintainers, not the published site.
  srcExclude: ['adr/**'],
  themeConfig: {
    logo: {
      light: '/bintastic-icon.svg',
      dark: '/bintastic-icon-dark.svg',
    },
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'API Reference', link: '/api/', activeMatch: '/api/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Usage', link: '/guide/usage' },
            { text: 'Debugging', link: '/guide/debugging' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: typedocSidebar,
        },
      ],
    },
    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/scalvert/bintastic' }],
  },
});
