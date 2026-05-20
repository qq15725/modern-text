import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/web-components/index',
    'src/deformations/index',
  ],
  declaration: true,
  clean: false,
  rollup: {
    emitCJS: true,
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
  },
})
