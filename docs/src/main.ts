import { measureText, renderText } from '../../src'
import type { RenderTextOptions } from '../../src'

const text: RenderTextOptions = {
  style: {
    fontSize: 39,
    height: 585,
    width: 159,
    // color: 'linear-gradient(0deg, rgb(235, 229, 229) 0%, rgba(235, 229, 229, 0) 90.7609%)',
    lineHeight: 2,
    letterSpacing: 13,
    writingMode: 'vertical-rl',
  },
  content: [
    '一束鲜花，一面春光',
    '欣于所遇，快然自足',
  ],
}

console.log(measureText(text))
document.body.append(renderText(text))
