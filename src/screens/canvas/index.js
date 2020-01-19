import {} from '../../libs/NeuQuant.js';
import {} from '../../libs/LZWEncoder.js';
import {} from '../../libs/GIFEncoder.js';
import * as CONSTANTS from '../../shared/constants.js';
import * as ENUMS from '../../shared/enums.js';
import * as KEYS from '../../shared/keys.js';

const LOCAL_STORAGE_KEY = 'data';
const ANIMATION_CANVAS = 'animation';
const SAVE_CANVAS = 'saveCanvas';
const PRIMARY_CANVAS = 'canvas';

new Vue({
  el: '#app',
  data() {
    return {
      currentTool: null,
      tools: [
        { func: this.penTool, ...ENUMS.PEN_PROPS },
        { func: this.bucketTool,  ...ENUMS.BUCKET_PROPS },
        { func: this.eraserTool, ...ENUMS.ERASER_PROPS },
        { func: this.strokeTool, ...ENUMS.STROKE_PROPS },
      ],
      penSizes: ENUMS.PEN_SIZES,
      currentPenSize: null,
      currentScale: null,
      primaryColor: CONSTANTS.DEFAULT_PRIMARY_COLOR,
      secondaryColor: CONSTANTS.DEFAULT_SECONDARY_COLOR,
      drawingColor: CONSTANTS.DEFAULT_PRIMARY_COLOR,
      scales: ENUMS.SCALES,
      frames: [],
      counter: CONSTANTS.INITIAL_COUNTER,
      currentFrameNumber: CONSTANTS.INITIAL_COUNTER,
      isDrawing: false,
      isLineDrawing: false,
      lineStartX0: CONSTANTS.INITIAL_COUNTER,
      lineStartY0: CONSTANTS.INITIAL_COUNTER,
      lastX: CONSTANTS.INITIAL_COUNTER,
      lastY: CONSTANTS.INITIAL_COUNTER,
      canvas: null,
      ctx: null,
      fps: CONSTANTS.DEFAULT_FPS,
      currentAnimationFrame: CONSTANTS.INITIAL_COUNTER,
      animationTimerId: null,
    };
  },
  mounted() {
    this.canvas = document.getElementById(PRIMARY_CANVAS);
    this.ctx = this.canvas.getContext(CONSTANTS.CANVAS_DIMENSION);
    const dataToUse = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    if (dataToUse) {
      this.currentTool = this.tools.find((tool) => tool.id === dataToUse.currentTool.id);
      this.currentPenSize = dataToUse.currentPenSize;
      this.currentScale = this.scales.find((scale) => scale.id === dataToUse.currentScale.id);
      this.primaryColor = dataToUse.primaryColor;
      this.secondaryColor = dataToUse.secondaryColor;
      this.frames = dataToUse.frames;
      Vue.nextTick(() => {
        for (let i = 0; i < this.frames.length; i += 1) {
          this.currentFrameNumber = i;
          this.drawOnFrame(i);
        }
      });
      this.counter = dataToUse.counter;
      this.currentFrameNumber = dataToUse.currentFrameNumber;
      this.fps = dataToUse.fps;
    } else {
      this.currentTool = this.tools[0];
      this.currentScale = this.scales[0];
      this.currentPenSize = this.penSizes[0].size;
      let source = this.generateMatrix(this.currentScale.scale);
      this.frames.push({ source, id: this.counter });
    }
    this.redraw(this.ctx, this.canvas);
    this.animate();
    this.initializeKeyboardShortcuts();
  },
  methods: {
    initializeKeyboardShortcuts() {
      const self = this;
      document.addEventListener('keydown', (e) => {
        e.preventDefault();
        const frameNum = self.currentFrameNumber;
        if (e.code === KEYS.PEN) {
          self.selectTool(self.tools[0]);
        } else if (e.code === KEYS.BUCKET) {
          self.selectTool(self.tools[1]);
        } else if (e.code === KEYS.ERASER) {
          self.selectTool(self.tools[2]);
        } else if (e.code === KEYS.SAVE && e.ctrlKey) {
          self.save();
        } else if (e.code === KEYS.STROKE) {
          self.selectTool(self.tools[3]);
        } else if (e.code === KEYS.PREVIOUS_FRAME) {
          self.selectFrame(frameNum > 0 ? frameNum - 1 : frameNum);
        } else if (e.code === KEYS.NEXT_FRAME) {
          self.selectFrame(frameNum < self.frames.length - 1 ? frameNum + 1 : frameNum);
        } else if (e.code === KEYS.COPY_FRAME && e.shiftKey) {
          self.copyFrame(frameNum);
        } else if (e.code === KEYS.ADD_FRAME) {
          self.addNewFrame();
        } else if (e.code === KEYS.DELETE_FRAME) {
          self.deleteFrame(frameNum);
        }
      });
    },
    selectTool(tool) {
      this.currentTool = tool;
      this.saveData();
    },
    selectScale(scale) {
      this.currentScale = scale;
      this.frames[this.currentFrameNumber].source = this.generateMatrix(this.currentScale.scale);
      this.redraw(this.ctx, this.canvas);
      this.saveData();
    },
    selectPenSize(size) {
      this.currentPenSize = size;
      this.saveData();
    },
    generateMatrix(n) {
      return Array.from({ length: n }).fill().map(() => Array.from({ length: n }, () => CONSTANTS.ERASER_COLOR));
    },
    redraw(ctx, canvas) {
      let context = ctx;
      const canvasScale = canvas.width / this.currentScale.scale;
      for (let i = 0; i < this.frames[this.currentFrameNumber].source.length; i += 1) {
        for (let j = 0; j < this.frames[this.currentFrameNumber].source[i].length; j += 1) {
          context.fillStyle = this.frames[this.currentFrameNumber].source[i][j];
          context.fillRect(j * canvasScale, i * canvasScale, canvasScale, canvasScale);
        }
      }
    },
    penTool(x, y) {
      this.drawLine(this.lastX, this.lastY, x, y);
    },
    eraserTool(x, y) {
      const i = Math.floor((x / this.canvas.width) * this.currentScale.scale);
      const j = Math.floor((y / this.canvas.width) * this.currentScale.scale);
      const canvasScale = this.canvas.width / this.currentScale.scale;
      const border = this.frames[this.currentFrameNumber].source.length - 1;
      for (let jSource = j; jSource <= Math.min(j + this.currentPenSize, border); jSource += 1) {
        for (let iSource = i; iSource <= Math.min(i + this.currentPenSize, border); iSource += 1) {
          this.frames[this.currentFrameNumber].source[jSource][iSource] = CONSTANTS.ERASER_COLOR;
        }
      }
      this.ctx.fillStyle = CONSTANTS.ERASER_COLOR;
      const penWidth = canvasScale * this.currentPenSize;
      this.ctx.fillRect(i * canvasScale, j * canvasScale, penWidth, penWidth);
    },
    drawPixel(i, j) {
      const canvasScale = this.canvas.width / this.currentScale.scale;
      const border = this.frames[this.currentFrameNumber].source.length - 1;
      for (let jSource = j; jSource <= Math.min(j + this.currentPenSize - 1, border); jSource += 1) {
        for (let iSource = i; iSource <= Math.min(i + this.currentPenSize - 1, border); iSource += 1) {
          this.frames[this.currentFrameNumber].source[jSource][iSource] = this.drawingColor;
        }
      }
      this.ctx.fillStyle = this.frames[this.currentFrameNumber].source[j][i];
      const penWidth = canvasScale * this.currentPenSize;
      this.ctx.fillRect(i * canvasScale, j * canvasScale, penWidth, penWidth);
    },
    drawLine(x0, y0, x1, y1) {
      let i0 = Math.floor((x0 / this.canvas.width) * this.currentScale.scale);
      let j0 = Math.floor((y0 / this.canvas.width) * this.currentScale.scale);
      let i1 = Math.floor((x1 / this.canvas.width) * this.currentScale.scale);
      let j1 = Math.floor((y1 / this.canvas.width) * this.currentScale.scale);
      let deltaI = Math.abs(i1 - i0);
      let deltaJ = Math.abs(j1 - j0);
      let signI = i0 < i1 ? 1 : -1;
      let signJ = j0 < j1 ? 1 : -1;
      let error = deltaI - deltaJ;
      while (i0 !== i1 || j0 !== j1) {
        this.drawPixel(i0, j0);
        let error2 = error * 2;
        if (error2 > -deltaJ) {
          error -= deltaJ;
          i0 += signI;
        }
        if (error2 < deltaI) {
          error += deltaI;
          j0 += signJ;
        }
      }
      this.drawPixel(i1, j1);
    },
    strokeTool(x, y) {
      if (!this.isLineDrawing) {
        this.lineStartX0 = x;
        this.lineStartY0 = y;
        this.isLineDrawing = true;
      }
    },
    onMouseDown(e) {
      this.isDrawing = true;
      if (e.button === CONSTANTS.SECONDARY_BUTTON) {
        this.drawingColor = this.secondaryColor;
      } else {
        this.drawingColor = this.primaryColor;
      }
      this.lastX = e.offsetX;
      this.lastY = e.offsetY;
      this.currentTool.func(this.lastX, this.lastY);
    },
    onMouseMove(e) {
      if (!this.isDrawing || this.isLineDrawing) {
        return;
      }
      this.currentTool.func(e.offsetX, e.offsetY);
      this.lastX = e.offsetX;
      this.lastY = e.offsetY;
    },
    onMouseUp(e) {
      if (this.isLineDrawing) {
        this.drawLine(this.lineStartX0, this.lineStartY0, e.offsetX, e.offsetY);
        this.isLineDrawing = false;
      }
      if (this.isLineDrawing || this.isDrawing) {
        this.drawOnFrame(this.currentFrameNumber);
      }
      this.isDrawing = false;
      this.saveData();
    },
    cancelContextMenu(e) {
      e.preventDefault();
    },
    bucketTool() {
      for (let i = 0; i < this.frames[this.currentFrameNumber].source.length; i += 1) {
        for (let j = 0; j < this.frames[this.currentFrameNumber].source[i].length; j += 1) {
          this.frames[this.currentFrameNumber].source[j][i] = this.drawingColor;
        }
      }
      this.ctx.fillStyle = this.drawingColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.width);
    },
    drawOnFrame(index) {
      let frame = document.querySelector(`.frame:nth-child(${index + 1}) canvas`);
      let frameCtx = frame.getContext(CONSTANTS.CANVAS_DIMENSION);
      this.redraw(frameCtx, frame);
    },
    addNewFrame() {
      let newSource = this.generateMatrix(this.currentScale.scale);
      this.counter += 1;
      this.frames.push({ source: newSource, id: this.counter });
      this.selectFrame(this.frames.length - 1);
      this.saveData();
    },
    selectFrame(index) {
      this.currentFrameNumber = index;
      this.redraw(this.ctx, this.canvas);
      this.saveData();
    },
    deleteFrame(index) {
      if (this.frames.length === 1) {
        return;
      }
      this.frames.splice(index, 1);
      if (index === this.currentFrameNumber) {
        this.selectFrame(0);
      } else if (index < this.currentFrameNumber) {
        this.selectFrame(this.currentFrameNumber - 1);
      }
      this.saveData();
    },
    copyFrame(index) {
      let copySource = JSON.parse(JSON.stringify(this.frames[index].source));
      this.counter += 1;
      this.frames.push({ source: copySource, id: this.counter });
      this.selectFrame(this.frames.length - 1);
      Vue.nextTick(() => this.drawOnFrame(this.frames.length - 1));
      this.saveData();
    },
    drawForAnimation() {
      let animationCanvas = document.getElementById(ANIMATION_CANVAS);
      let context = animationCanvas.getContext(CONSTANTS.CANVAS_DIMENSION);
      const canvasScale = animationCanvas.width / this.currentScale.scale;
      for (let i = 0; i < this.frames[this.currentAnimationFrame].source.length; i += 1) {
        for (let j = 0; j < this.frames[this.currentAnimationFrame].source[i].length; j += 1) {
          context.fillStyle = this.frames[this.currentAnimationFrame].source[i][j];
          context.fillRect(j * canvasScale, i * canvasScale, canvasScale, canvasScale);
        }
      }
    },
    animate() {
      let self = this;
      self.animationTimerId = setInterval(() => {
        if (self.currentAnimationFrame + 1 >= self.frames.length) {
          self.currentAnimationFrame = 0;
        } else {
          self.currentAnimationFrame += 1;
        }
        self.drawForAnimation();
      }, 1000 / self.fps);
    },
    save() {
      let saveCanvas = document.getElementById(SAVE_CANVAS);
      let context = saveCanvas.getContext(CONSTANTS.CANVAS_DIMENSION);
      let encoder = new GIFEncoder();
      encoder.setRepeat(0);
      encoder.setDelay(1000 / this.fps); // 1 second / frames per second
      encoder.start();
      for (let frameNum = 0; frameNum < this.frames.length; frameNum += 1) {
        const canvasScale = saveCanvas.width / this.currentScale.scale;
        for (let i = 0; i < this.frames[frameNum].source.length; i += 1) {
          for (let j = 0; j < this.frames[frameNum].source[i].length; j += 1) {
            context.fillStyle = this.frames[frameNum].source[i][j];
            context.fillRect(j * canvasScale, i * canvasScale, canvasScale, canvasScale);
          }
        }
        encoder.addFrame(context);
      }
      encoder.finish();
      encoder.download(CONSTANTS.EXPORT_FILE_NAME);
    },
    saveData() {
      const dataToSave = {
        currentTool: this.currentTool,
        currentPenSize: this.currentPenSize,
        currentScale: this.currentScale,
        primaryColor: this.primaryColor,
        secondaryColor: this.secondaryColor,
        frames: this.frames,
        counter: this.counter,
        currentFrameNumber: this.currentFrameNumber,
        fps: this.fps,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    },
    toggleFullScreen() {
      if (!document.fullscreenElement) {
        document.getElementById(ANIMATION_CANVAS).requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    },
    reset() {
      this.primaryColor = CONSTANTS.DEFAULT_PRIMARY_COLOR;
      this.secondaryColor = CONSTANTS.DEFAULT_SECONDARY_COLOR;
      this.frames = [];
      this.currentFrameNumber = CONSTANTS.INITIAL_COUNTER;
      this.fps = CONSTANTS.DEFAULT_FPS;
      const source = this.generateMatrix(this.currentScale.scale);
      this.frames.push({ source, id: this.counter });
      this.redraw(this.ctx, this.canvas);
      Vue.nextTick(() => {
        this.drawOnFrame(CONSTANTS.INITIAL_COUNTER);
      })
    }
  },
  watch: {
    fps() {
      clearInterval(this.animationTimerId);
      this.animate();
    },
  },

});
