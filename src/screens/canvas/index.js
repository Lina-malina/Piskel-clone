import {} from '../../libs/NeuQuant.js';
import {} from '../../libs/LZWEncoder.js';
import {} from '../../libs/GIFEncoder.js';

new Vue({
  el: '#app',
  data() {
    return {
      currentTool: null,
      tools: [
        {
          name: 'pen', icon: 'fas fa-pen', id: 'pen', func: this.penTool, key: 'Pen tool (p)',
        },
        {
          name: 'bucket', icon: 'fas fa-fill', id: 'bucket', func: this.bucketTool, key: 'Bucket tool (b)',
        },
        {
          name: 'eraser', icon: 'fas fa-eraser', id: 'eraser', func: this.eraserTool, key: 'Eraser tool (e)',
        },
        {
          name: 'stroke', icon: 'fas fa-pencil-ruler', id: 'stroke', func: this.strokeTool, key: 'Stroke tool (s)',
        },
      ],
      penSizes: [
        { size: 1, style: 'px1' },
        { size: 2, style: 'px2' },
        { size: 3, style: 'px3' },
        { size: 4, style: 'px4' },
      ],
      currentPenSize: null,
      currentScale: null,
      primaryColor: '#000000',
      secondaryColor: '#FF0000',
      drawingColor: '#000000',
      scales: [
        { scale: 32, size: '32x32', id: '32' },
        { scale: 64, size: '64x64', id: '64' },
        { scale: 128, size: '128x128', id: '128' },
      ],
      frames: [],
      counter: 0,
      currentFrameNumber: 0,
      isDrawing: false,
      isLineDrawing: false,
      lineStartX0: 0,
      lineStartY0: 0,
      lastX: 0,
      lastY: 0,
      canvas: null,
      ctx: null,
      fps: 12,
      currentAnimationFrame: 0,
      animationTimerId: null,
    };
  },
  mounted() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    const dataToUse = JSON.parse(localStorage.getItem('data'));
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
    const self = this;
    document.addEventListener('keydown', (e) => {
      e.preventDefault();
      const frameNum = self.currentFrameNumber;
      if (e.code === 'KeyP') {
        self.selectTool(self.tools[0]);
      } else if (e.code === 'KeyB') {
        self.selectTool(self.tools[1]);
      } else if (e.code === 'KeyE') {
        self.selectTool(self.tools[2]);
      } else if (e.code === 'KeyS' && e.ctrlKey) {
        self.save();
      } else if (e.code === 'KeyS') {
        self.selectTool(self.tools[3]);
      } else if (e.code === 'ArrowUp') {
        self.selectFrame(frameNum > 0 ? frameNum - 1 : frameNum);
      } else if (e.code === 'ArrowDown') {
        self.selectFrame(frameNum < self.frames.length - 1 ? frameNum + 1 : frameNum);
      } else if (e.code === 'KeyN' && e.shiftKey) {
        self.copyFrame(frameNum);
      } else if (e.code === 'KeyN') {
        self.addNewFrame();
      } else if (e.code === 'Delete') {
        self.deleteFrame(frameNum);
      }
    });
  },
  methods: {
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
      return Array.from({ length: n }).fill().map(() => Array.from({ length: n }, () => '#FFF'));
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
      const whiteColor = '#FFF';
      const i = Math.floor((x / this.canvas.width) * this.currentScale.scale);
      const j = Math.floor((y / this.canvas.width) * this.currentScale.scale);
      const canvasScale = this.canvas.width / this.currentScale.scale;
      const border = this.frames[this.currentFrameNumber].source.length - 1;
      for (let jSource = j; jSource <= Math.min(j + this.currentPenSize, border); jSource += 1) {
        for (let iSource = i; iSource <= Math.min(i + this.currentPenSize, border); iSource += 1) {
          this.frames[this.currentFrameNumber].source[jSource][iSource] = whiteColor;
        }
      }
      this.ctx.fillStyle = whiteColor;
      const penWidth = canvasScale * this.currentPenSize;
      this.ctx.fillRect(i * canvasScale, j * canvasScale, penWidth, penWidth);
    },
    drawPixel(i, j) {
      const canvasScale = this.canvas.width / this.currentScale.scale;
      const border = this.frames[this.currentFrameNumber].source.length - 1;
      for (let jSource = j; jSource <= Math.min(j + this.currentPenSize, border); jSource += 1) {
        for (let iSource = i; iSource <= Math.min(i + this.currentPenSize, border); iSource += 1) {
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
      if (e.button === 2) {
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
      this.ctx.fillRect(0, 0, 512, 512);
    },
    drawOnFrame(index) {
      let frame = document.querySelector(`.frame:nth-child(${index + 1}) canvas`);
      let frameCtx = frame.getContext('2d');
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
      let animationCanvas = document.getElementById('animation');
      let context = animationCanvas.getContext('2d');
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
      let saveCanvas = document.getElementById('saveCanvas');
      let context = saveCanvas.getContext('2d');
      let encoder = new GIFEncoder();
      encoder.setRepeat(0);
      encoder.setDelay(1000 / this.fps);
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
      encoder.download('yourAwesome.gif');
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
      localStorage.setItem('data', JSON.stringify(dataToSave));
    },
    toggleFullScreen() {
      if (!document.fullscreenElement) {
        document.getElementById('animation').requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    },
  },
  watch: {
    fps() {
      clearInterval(this.animationTimerId);
      this.animate();
    },
  },

});
