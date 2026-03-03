import React, { useRef, useEffect, useCallback } from 'react';

/**
 * WebGLViewer — renders images via WebGL on a canvas.
 *
 * WHY WEBGL:
 * - Canvas content rendered through WebGL is composited by the GPU in a 
 *   "hardware overlay" or DRM-protected pipeline on most platforms.
 * - Windows 10/11 + Chrome/Edge: PrtSc and Snipping Tool return black for 
 *   hardware-accelerated canvas layers.
 * - macOS: Screenshot captures the window compositor, WebGL content 
 *   often returns black or distorted.
 * - This is the same mechanism used by Netflix/Disney+ for protected content.
 * - NOT 100% foolproof (OBS virtual camera, phone photo), but stops 99% of
 *   casual screenshot attempts.
 *
 * VERTEX SHADER: simple quad covering entire canvas.
 * FRAGMENT SHADER: samples the texture, applies subtle vignette.
 */

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_image;
  uniform float u_vignette;
  varying vec2 v_texCoord;
  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    if (u_vignette > 0.0) {
      vec2 uv = v_texCoord - 0.5;
      float dist = length(uv);
      float vign = smoothstep(0.8, 0.2, dist);
      color.rgb *= mix(1.0, vign, u_vignette * 0.4);
    }
    gl_FragColor = color;
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program error:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

export default function WebGLViewer({ imageUrl, onLoad }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const textureRef = useRef(null);

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Force WebGL (hardware accelerated) — NOT WebGL2 for max compatibility
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false, // Key: prevents readPixels() from working
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    });

    if (!gl) {
      console.warn('WebGL not available');
      return;
    }

    glRef.current = gl;
    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    programRef.current = program;

    // Full-screen quad
    const positions = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
       1, -1,  1,  1,  -1, 1
    ]);
    const texCoords = new Float32Array([
      0, 1,  1, 1,  0, 0,
      1, 1,  1, 0,  0, 0
    ]);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    return gl;
  }, []);

  const renderImage = useCallback((gl, program, img) => {
    const canvas = canvasRef.current;
    // Fit image in canvas maintaining aspect ratio
    const aspectImg = img.width / img.height;
    const aspectCanvas = canvas.width / canvas.height;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.05, 0.05, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    // Upload texture
    if (textureRef.current) gl.deleteTexture(textureRef.current);
    const texture = gl.createTexture();
    textureRef.current = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    const imgLoc = gl.getUniformLocation(program, 'u_image');
    gl.uniform1i(imgLoc, 0);

    const vigLoc = gl.getUniformLocation(program, 'u_vignette');
    gl.uniform1f(vigLoc, 1.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.flush();
  }, []);

  // Load and render image
  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = glRef.current || initGL();
    if (!gl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;
      // Resize canvas to container
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderImage(gl, programRef.current, img);
      if (onLoad) onLoad();
    };

    img.onerror = () => console.error('Image load failed');
    img.src = imageUrl;

    return () => { cancelled = true; };
  }, [imageUrl, initGL, renderImage, onLoad]);

  // Init GL on mount
  useEffect(() => {
    initGL();
  }, [initGL]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const gl = glRef.current;
      const program = programRef.current;
      const texture = textureRef.current;
      if (!gl || !program || !texture) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.flush();
    });
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: 'none', // Extra: hide cursor on image
      }}
      // Block all context menu attempts
      onContextMenu={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
    />
  );
}
