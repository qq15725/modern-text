import type { Text } from '../../src'

const twgl = (window as any).twgl

const vsSource = `precision mediump float;
attribute vec2 position;
void main() {
  vec2 clip = position * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`

const fsSource = `precision mediump float;
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`

export function webglRender(text: Text, canvas: HTMLCanvasElement): void {
  const pathData = {
    lineBox: text.lineBox.array.join(', '),
    glyphBox: text.glyphBox.array.join(', '),
    pathBox: text.pathBox.array.join(', '),
    boundingBox: text.boundingBox.array.join(', '),
    chars: [] as any[],
    paths: [] as any[],
  }
  text.paragraphs.forEach((p) => {
    p.fragments.forEach((f) => {
      f.characters.forEach((c) => {
        const triangulate = c.path.fillTriangulate()
        pathData.chars.push({
          char: c.content,
          path: c.path.toData(),
          lineBox: c.lineBox.array.join(', '),
          inlineBox: c.inlineBox.array.join(', '),
          glyphBox: c.glyphBox?.array.join(', '),
          triangulate: {
            indices: triangulate.indices.join(', '),
            vertices: triangulate.vertices.join(', '),
          },
        })
      })
    })
  })

  text.pathSets.forEach((pathSet) => {
    pathSet.paths.forEach((path) => {
      const triangulate = path.fillTriangulate()
      pathData.paths.push({
        style: { ...path.style },
        path: path.toData(),
        triangulate: {
          indices: triangulate.indices.join(', '),
          vertices: triangulate.vertices.join(', '),
        },
      })
    })
  })

  const { width, height } = text.boundingBox

  const pixelRatio = 2
  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const indices: number[] = []
  const vertices: number[] = []
  let offset = 0

  pathData.paths.forEach((p: Record<string, any>) => {
    offset = vertices.length / 2
    indices.push(
      ...p.triangulate.indices.split(',').map((v: string) =>
        Number(v) + offset,
      ),
    )
    vertices.push(
      ...p.triangulate.vertices.split(',').map((v: string, i: number) =>
        i % 2 === 0
          ? (Number(v) / width)
          : (Number(v) / height),
      ),
    )
  })

  const gl = canvas.getContext('webgl2')

  if (!gl) {
    return
  }

  const arrays = {
    position: { numComponents: 2, data: vertices },
    indices: { numComponents: 1, data: indices },
  }
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)
  const programInfo = twgl.createProgramInfo(gl, [vsSource, fsSource])

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(programInfo.program)
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo)
  twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLES)

  console.warn(pathData)
}
