const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let image = new Image();
let originalImage = null;
let originalColorImage = null;
let pins = [];
let lines = [];
let brightnessMap = [];
let isEditing = false;
let draggingPin = null;
let showImage = true;
let showLines = true;
let showPins = false;
let lineDensityMap = [];
let cropper = null;
let isPaused = false;
let currentStep = 0;
let lastPin = 0;
let usedPairs = new Set();
const { jsPDF } = window.jspdf;
const startBtn = document.getElementById('startBtn');
const stepSlider = document.getElementById('stepSlider');
const stepValue = document.getElementById('stepValue');
const sampleImages = [
  'https://via.placeholder.com/150?text=Sample+1',
  'https://via.placeholder.com/150?text=Sample+2',
  'https://via.placeholder.com/150?text=Sample+3'
];
let realTimeInterval = null;
let realTimeStep = 0;
let isRealTimePlaying = false;
let realTimeShowImage = true;
let realTimeShowPins = true;
let realTimeShowLines = true;
const realTimeCanvas = document.getElementById('realTimeCanvas');
const realTimeCtx = realTimeCanvas ? realTimeCanvas.getContext('2d') : null;
let isGrayscale = false;

const paperSizes = {
  'Default': { width: 800, height: 800, maxPins: 1000 },
  'A4': { width: 1240, height: 1754, maxPins: 200 },
  'A3': { width: 1754, height: 2481, maxPins: 400 },
  'A2': { width: 2481, height: 3509, maxPins: 800 },
  'A1': { width: 3509, height: 4962, maxPins: 1000 }
};

function updateCanvasSize() {
  const paperSize = document.getElementById('paperSize').value;
  const { width, height, maxPins } = paperSizes[paperSize];
  canvas.width = width;
  canvas.height = height;

  const pinInput = document.getElementById('pins');
  const pinSlider = document.getElementById('pinsSlider');
  pinInput.max = maxPins;
  pinSlider.max = maxPins;
  if (parseInt(pinInput.value) > maxPins) {
    pinInput.value = maxPins;
    pinSlider.value = maxPins;
  }

  const pinPresets = document.getElementById('pinPresets');
  pinPresets.innerHTML = '';
  const pinOptions = paperSize === 'Default' ? [200, 400, 600, 800, 1000] :
                     paperSize === 'A4' ? [200] :
                     paperSize === 'A3' ? [200, 400] :
                     paperSize === 'A2' ? [400, 600, 800] :
                     [400, 600, 800, 1000];
  pinOptions.forEach(pin => {
    const option = document.createElement('option');
    option.value = pin;
    option.textContent = pin;
    pinPresets.appendChild(option);
  });
  pinPresets.value = Math.min(pinOptions[0], maxPins);
  pinInput.value = pinPresets.value;
  pinSlider.value = pinPresets.value;

  updatePins();
  enableStartButton();
  redrawCanvas();
}

document.getElementById('upload').addEventListener('change', function (e) {
  const reader = new FileReader();
  reader.onload = function (event) {
    image = new Image();
    image.onload = () => {
      document.getElementById('cropImage').src = event.target.result;
      document.getElementById('cropModal').style.display = 'block';
      if (cropper) cropper.destroy();
      cropper = new Cropper(document.getElementById('cropImage'), {
        aspectRatio: canvas.width / canvas.height,
        viewMode: 1,
        autoCropArea: 0.8,
      });
    };
    image.src = event.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
});

function cropImage() {
  const croppedCanvas = cropper.getCroppedCanvas({ width: canvas.width, height: canvas.height });
  originalImage = document.createElement("canvas");
  originalImage.width = canvas.width;
  originalImage.height = canvas.height;
  const octx = originalImage.getContext("2d");
  octx.drawImage(croppedCanvas, 0, 0, canvas.width, canvas.height);
  
  originalColorImage = document.createElement("canvas");
  originalColorImage.width = canvas.width;
  originalColorImage.height = canvas.height;
  const colorCtx = originalColorImage.getContext("2d");
  colorCtx.drawImage(croppedCanvas, 0, 0, canvas.width, canvas.height);
  
  applyFilters();
  redrawCanvas();
  closeCropModal();
}

function closeCropModal() {
  document.getElementById('cropModal').style.display = 'none';
  if (cropper) cropper.destroy();
}

function openSampleModal(index) {
  document.getElementById('sampleImage').src = sampleImages[index];
  document.getElementById('sampleModal').style.display = 'block';
}

function selectSampleImage() {
  image = new Image();
  image.onload = () => {
    originalImage = document.createElement("canvas");
    originalImage.width = canvas.width;
    originalImage.height = canvas.height;
    const octx = originalImage.getContext("2d");
    octx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    originalColorImage = document.createElement("canvas");
    originalColorImage.width = canvas.width;
    originalColorImage.height = canvas.height;
    const colorCtx = originalColorImage.getContext("2d");
    colorCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    applyFilters();
    redrawCanvas();
    closeSampleModal();
  };
  image.src = document.getElementById('sampleImage').src;
}

function closeSampleModal() {
  document.getElementById('sampleModal').style.display = 'none';
}

function toggleGrayscale() {
  if (!originalImage || !originalColorImage) return;
  
  if (isGrayscale) {
    const octx = originalImage.getContext("2d");
    octx.drawImage(originalColorImage, 0, 0, canvas.width, canvas.height);
    document.getElementById('grayscaleBtn').textContent = "Chuyển ảnh Trắng Đen";
    isGrayscale = false;
  } else {
    const octx = originalImage.getContext("2d");
    const imgData = octx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = data[i + 1] = data[i + 2] = gray;
    }

    octx.putImageData(imgData, 0, 0);
    document.getElementById('grayscaleBtn').textContent = "Chuyển ảnh Màu";
    isGrayscale = true;
  }
  
  applyFilters();
  redrawCanvas();
}

function updateSliderValues() {
  document.getElementById('brightnessValue').textContent = document.getElementById('brightness').value;
  document.getElementById('contrastValue').textContent = document.getElementById('contrast').value;
  document.getElementById('threadWidthValue').textContent = document.getElementById('threadWidth').value;
  stepValue.textContent = stepSlider.value;
}

document.getElementById("brightness").addEventListener("input", () => {
  applyFilters();
  redrawCanvas();
  updateSliderValues();
});
document.getElementById("contrast").addEventListener("input", () => {
  applyFilters();
  redrawCanvas();
  updateSliderValues();
});
document.getElementById("threadWidth").addEventListener("input", () => {
  redrawCanvas();
  updateSliderValues();
});
stepSlider.addEventListener("input", () => {
  updateSliderValues();
  redrawCanvas();
});

function applyFilters() {
  if (!originalImage) return;
  const brightness = parseInt(document.getElementById("brightness").value);
  const contrast = parseInt(document.getElementById("contrast").value);
  const octx = originalImage.getContext("2d");
  const imgData = octx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      let val = data[i + j];
      val = factor * (val - 128) + 128 + brightness;
      data[i + j] = Math.min(255, Math.max(0, val));
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function getPoints(pinCount, shape) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) / 2 - 50;
  const points = [];

  if (shape === 'circle') {
    for (let i = 0; i < pinCount; i++) {
      const angle = 2 * Math.PI * i / pinCount;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push({ x, y });
    }
  } else if (shape === 'square') {
    const sideLength = 2 * radius;
    const perimeter = 4 * sideLength;
    const spacing = perimeter / pinCount;
    let currentX = centerX - radius;
    let currentY = centerY - radius;
    let sideIndex = 0;

    for (let i = 0; i < pinCount; i++) {
      points.push({ x: currentX, y: currentY });

      if (sideIndex === 0) { // Top side: move right
        currentX += spacing;
        if (currentX >= centerX + radius) {
          currentX = centerX + radius;
          currentY = centerY - radius;
          sideIndex = 1;
        }
      } else if (sideIndex === 1) { // Right side: move down
        currentY += spacing;
        if (currentY >= centerY + radius) {
          currentY = centerY + radius;
          currentX = centerX + radius;
          sideIndex = 2;
        }
      } else if (sideIndex === 2) { // Bottom side: move left
        currentX -= spacing;
        if (currentX <= centerX - radius) {
          currentX = centerX - radius;
          currentY = centerY + radius;
          sideIndex = 3;
        }
      } else if (sideIndex === 3) { // Left side: move up
        currentY -= spacing;
        if (currentY <= centerY - radius) {
          currentY = centerY - radius;
          currentX = centerX - radius;
          sideIndex = 0;
        }
      }
    }
  } else if (shape === 'oval') {
    const radiusX = radius * 1.2;
    const radiusY = radius * 0.8;
    for (let i = 0; i < pinCount; i++) {
      const angle = 2 * Math.PI * i / pinCount;
      const x = centerX + radiusX * Math.cos(angle);
      const y = centerY + radiusY * Math.sin(angle);
      points.push({ x, y });
    }
  }
  return points;
}

function updatePins() {
  const pinCount = parseInt(document.getElementById('pins').value);
  const shape = document.getElementById('shape').value;
  pins = getPoints(pinCount, shape);
  if (showPins) {
    redrawCanvas();
  }
}

document.getElementById('pinsSlider').addEventListener('input', () => {
  const pinInput = document.getElementById('pins');
  pinInput.value = document.getElementById('pinsSlider').value;
  updatePins();
  enableStartButton();
});

document.getElementById('pins').addEventListener('input', () => {
  const pinSlider = document.getElementById('pinsSlider');
  pinSlider.value = document.getElementById('pins').value;
  updatePins();
  enableStartButton();
});

canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('touchstart', startDrag);
canvas.addEventListener('mousemove', onDrag);
canvas.addEventListener('touchmove', onDrag);
canvas.addEventListener('mouseup', stopDrag);
canvas.addEventListener('touchend', stopDrag);

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrag(e) {
  if (!isEditing) return;
  const pos = getMousePos(e);
  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    if (Math.hypot(pos.x - pin.x, pos.y - pin.y) < 10) {
      draggingPin = i;
      break;
    }
  }
}

function onDrag(e) {
  if (draggingPin !== null && isEditing) {
    const pos = getMousePos(e);
    pins[draggingPin] = pos;
    redrawCanvas();
  }
}

function stopDrag() { draggingPin = null; }

function toggleEditPins() {
  isEditing = !isEditing;
  document.getElementById('editBtn').textContent = `Chỉnh sửa đinh: ${isEditing ? 'Bật' : 'Tắt'}`;
}

function getBrightnessMap() {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const map = new Array(canvas.height).fill().map(() => new Array(canvas.width).fill(255));
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      map[y][x] = 255 - (0.299 * r + 0.587 * g + 0.114 * b);
    }
  }
  return map;
}

function sampleLineBrightness(x1, y1, x2, y2, map) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.floor(length);
  let brightnessSum = 0;
  let densitySum = 0;
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x1 + (x2 - x1) * i / steps);
    const y = Math.round(y1 + (y2 - y1) * i / steps);
    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      brightnessSum += map[y][x];
      densitySum += lineDensityMap[y][x];
    }
  }
  const brightnessScore = brightnessSum / steps;
  const densityScore = densitySum / steps;
  const densityPenalty = Math.min(1, densityScore / 100);
  const coverageBonus = (255 - densityScore) / 255;
  return brightnessScore * (1 - 0.5 * densityPenalty) + 50 * coverageBonus;
}

function updateLineDensity(x1, y1, x2, y2) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.floor(length);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x1 + (x2 - x1) * i / steps);
    const y = Math.round(y1 + (y2 - y1) * i / steps);
    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      lineDensityMap[y][x] = Math.min(255, lineDensityMap[y][x] + 15);
    }
  }
}

function generateSmartStringArt(fromEdit = false) {
  const pinCount = parseInt(document.getElementById('pins').value);
  const steps = parseInt(document.getElementById('steps').value);
  const shape = document.getElementById('shape').value;

  if (!fromEdit || pins.length === 0) {
    pins = getPoints(pinCount, shape);
    lines = [];
    currentStep = 0;
    lastPin = 0;
    usedPairs = new Set();
    applyFilters();
    brightnessMap = getBrightnessMap();
    lineDensityMap = new Array(canvas.height).fill().map(() => new Array(canvas.width).fill(0));
  }

  isPaused = false;
  startBtn.disabled = true;
  document.getElementById('pauseBtn').textContent = 'Tạm dừng';
  document.getElementById('progressBar').style.display = 'block';
  document.getElementById('progressText').style.display = 'inline';

  function stepLoop() {
    if (isPaused || currentStep >= steps) {
      if (currentStep >= steps) {
        document.getElementById('progressBar').style.display = 'none';
        document.getElementById('progressText').style.display = 'none';
        startBtn.disabled = false;
        stepSlider.max = lines.length;
        stepSlider.value = lines.length;
        stepSlider.disabled = false;
        updateSliderValues();
      }
      redrawCanvas();
      return;
    }

    let bestScore = -1, bestPin = null;
    for (let j = 0; j < pins.length; j++) {
      if (j === lastPin) continue;
      const key = `${Math.min(lastPin, j)}-${Math.max(lastPin, j)}`;
      if (usedPairs.has(key)) continue;

      const score = sampleLineBrightness(pins[lastPin].x, pins[lastPin].y, pins[j].x, pins[j].y, brightnessMap);
      if (score > bestScore) {
        bestScore = score;
        bestPin = j;
      }
    }

    if (bestPin !== null) {
      const a = pins[lastPin], b = pins[bestPin];
      lines.push({ from: lastPin, to: bestPin });
      usedPairs.add(`${Math.min(lastPin, bestPin)}-${Math.max(lastPin, bestPin)}`);
      updateLineDensity(a.x, a.y, b.x, b.y);
      lastPin = bestPin;

      if (showLines) {
        ctx.strokeStyle = document.getElementById('threadColor').value;
        ctx.lineWidth = parseFloat(document.getElementById('threadWidth').value);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    currentStep++;
    const progress = (currentStep / steps) * 100;
    document.getElementById('progressBar').value = progress;
    document.getElementById('progressText').textContent = `${Math.round(progress)}% - Bước ${currentStep}/${steps}`;
    setTimeout(stepLoop, 1);
  }

  stepLoop();
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById('pauseBtn').textContent = isPaused ? 'Tiếp tục' : 'Tạm dừng';
  if (!isPaused) generateSmartStringArt(true);
}

function drawPinsAndLabels(ctx, canvas, shape, pins) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) / 2 - 50;
  ctx.font = "13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  pins.forEach((pin, index) => {
    ctx.fillStyle = (index % 5 === 0) ? "#006400" : "#ff0000";
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, (index % 5 === 0) ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();

    if (index % 5 === 0 && index !== pins.length - 1) {
      let labelX, labelY;
      if (shape === 'circle') {
        const angle = Math.atan2(pin.y - centerY, pin.x - centerX);
        labelX = centerX + (radius + 20) * Math.cos(angle);
        labelY = centerY + (radius + 20) * Math.sin(angle);
      } else if (shape === 'square') {
        labelX = pin.x;
        labelY = pin.y;
        const tolerance = 5;
        if (Math.abs(pin.y - (centerY - radius)) < tolerance) { // Top
          labelY -= 20;
        } else if (Math.abs(pin.y - (centerY + radius)) < tolerance) { // Bottom
          labelY += 20;
        } else if (Math.abs(pin.x - (centerX - radius)) < tolerance) { // Left
          labelX -= 20;
        } else if (Math.abs(pin.x - (centerX + radius)) < tolerance) { // Right
          labelX += 20;
        }
      } else if (shape === 'oval') {
        const radiusX = radius * 1.2;
        const radiusY = radius * 0.8;
        const angle = Math.atan2((pin.y - centerY) / radiusY, (pin.x - centerX) / radiusX);
        labelX = centerX + (radiusX + 20) * Math.cos(angle);
        labelY = centerY + (radiusY + 20) * Math.sin(angle);
      }
      ctx.fillStyle = "#000";
      ctx.fillText(index.toString(), labelX, labelY);
    }
  });
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (showImage && originalImage) {
    applyFilters();
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (showLines) {
    ctx.strokeStyle = document.getElementById('threadColor').value;
    ctx.lineWidth = parseFloat(document.getElementById('threadWidth').value);
    const visibleLines = lines.slice(0, parseInt(stepSlider.value));
    for (let line of visibleLines) {
      const a = pins[line.from], b = pins[line.to];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  if (showPins && pins.length > 0) {
    const shape = document.getElementById('shape').value;
    drawPinsAndLabels(ctx, canvas, shape, pins);
  }
}

function toggleImage() {
  showImage = !showImage;
  document.getElementById('toggleImageBtn').textContent = `Ảnh: ${showImage ? 'Bật' : 'Tắt'}`;
  redrawCanvas();
}

function togglePins() {
  showPins = !showPins;
  if (showPins) {
    updatePins();
  }
  document.getElementById('togglePinsBtn').textContent = `Đinh: ${showPins ? 'Bật' : 'Tắt'}`;
  redrawCanvas();
}

function toggleLines() {
  showLines = !showLines;
  document.getElementById('toggleLinesBtn').textContent = `Chỉ: ${showLines ? 'Bật' : 'Tắt'}`;
  redrawCanvas();
}

function toggleRealTimeImage() {
  realTimeShowImage = !realTimeShowImage;
  document.getElementById('realTimeImageBtn').textContent = `Ảnh: ${realTimeShowImage ? 'Bật' : 'Tắt'}`;
  redrawRealTimeCanvas();
}

function toggleRealTimePins() {
  realTimeShowPins = !realTimeShowPins;
  document.getElementById('realTimePinsBtn').textContent = `Đinh: ${realTimeShowPins ? 'Bật' : 'Tắt'}`;
  redrawRealTimeCanvas();
}

function toggleRealTimeLines() {
  realTimeShowLines = !realTimeShowLines;
  document.getElementById('realTimeLinesBtn').textContent = `Chỉ: ${realTimeShowLines ? 'Bật' : 'Tắt'}`;
  redrawRealTimeCanvas();
}

function redrawRealTimeCanvas() {
  if (!realTimeCtx) return;
  realTimeCtx.clearRect(0, 0, realTimeCanvas.width, realTimeCanvas.height);
  realTimeCtx.fillStyle = "#fff";
  realTimeCtx.fillRect(0, 0, realTimeCanvas.width, realTimeCanvas.height);

  if (realTimeShowImage && originalImage) {
    realTimeCtx.drawImage(originalImage, 0, 0, realTimeCanvas.width, realTimeCanvas.height);
  }

  if (realTimeShowLines) {
    realTimeCtx.strokeStyle = document.getElementById('threadColor').value;
    realTimeCtx.lineWidth = parseFloat(document.getElementById('threadWidth').value);
    const visibleLines = lines.slice(0, realTimeStep + 1);
    for (let line of visibleLines) {
      const a = pins[line.from], b = pins[line.to];
      realTimeCtx.beginPath();
      realTimeCtx.moveTo(a.x, a.y);
      realTimeCtx.lineTo(b.x, b.y);
      realTimeCtx.stroke();
    }
  }

  if (realTimeShowPins && pins.length > 0) {
    const shape = document.getElementById('shape').value;
    drawPinsAndLabels(realTimeCtx, realTimeCanvas, shape, pins);
  }
}

function downloadPNG() {
  const link = document.createElement("a");
  link.download = "string-art.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function downloadSVG() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
    ${lines.map(line => 
      `<line x1="${pins[line.from].x}" y1="${pins[line.from].y}" x2="${pins[line.to].x}" y2="${pins[line.to].y}" stroke="${document.getElementById('threadColor').value}" stroke-width="${document.getElementById('threadWidth').value}"/>`).join('')}
  </svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "string-art.svg";
  a.click();
  URL.revokeObjectURL(url);
}

function saveToLocal() {
  const data = {
    pins, 
    lines,
    threadColor: document.getElementById('threadColor').value,
    threadWidth: document.getElementById('threadWidth').value,
    pinCount: document.getElementById('pins').value,
    steps: document.getElementById('steps').value,
    shape: document.getElementById('shape').value,
    paperSize: document.getElementById('paperSize').value
  };
  localStorage.setItem("stringArtSave", JSON.stringify(data));
  alert("Đã lưu!");
}

function openExportModal() {
  if (pins.length === 0) {
    alert("Vui lòng tạo tranh hoặc bật hiển thị đinh trước khi tải PDF!");
    return;
  }
  document.getElementById('exportModal').style.display = 'block';
  document.getElementById('maxSteps').textContent = lines.length;
  document.getElementById('exportSteps').value = lines.length;
  document.getElementById('exportSteps').max = lines.length;
  updateExportModal();
}

function closeExportModal() {
  document.getElementById('exportModal').style.display = 'none';
}

function updateExportModal() {
  const exportType = document.getElementById('exportType').value;
  const stepsInput = document.getElementById('stepsInput');
  const includeImageOption = document.getElementById('includeImageOption');
  
  if (exportType === "1" || exportType === "3") {
    stepsInput.style.display = 'block';
    includeImageOption.style.display = 'block';
    if (lines.length === 0) {
      alert("Vui lòng tạo tranh trước khi chọn tùy chọn có mã số!");
      document.getElementById('exportType').value = "2";
      stepsInput.style.display = 'none';
      includeImageOption.style.display = 'none';
    }
  } else {
    stepsInput.style.display = 'none';
    includeImageOption.style.display = 'none';
  }
}

document.getElementById('exportType').addEventListener('change', updateExportModal);

function downloadNumberPDF() {
  const exportType = document.getElementById('exportType').value;
  const paperSize = document.getElementById('paperSize').value === 'Default' ? 'A4' : document.getElementById('paperSize').value;
  const shape = document.getElementById('shape').value;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: paperSize.toLowerCase()
  });

  doc.setFont("times");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  const stringArtCanvas = document.createElement('canvas');
  stringArtCanvas.width = canvas.width;
  stringArtCanvas.height = canvas.height;
  const stringArtCtx = stringArtCanvas.getContext('2d');

  stringArtCtx.fillStyle = "#fff";
  stringArtCtx.fillRect(0, 0, stringArtCanvas.width, stringArtCanvas.height);

  const exportSteps = parseInt(document.getElementById('exportSteps').value);
  if (exportType === "1" || exportType === "3") {
    if (isNaN(exportSteps) || exportSteps <= 0 || exportSteps > lines.length) {
      alert(`Số bước không hợp lệ! Vui lòng nhập số từ 1 đến ${lines.length}.`);
      return;
    }

    stringArtCtx.strokeStyle = document.getElementById('threadColor').value;
    stringArtCtx.lineWidth = parseFloat(document.getElementById('threadWidth').value);
    for (let line of lines.slice(0, exportSteps)) {
      const a = pins[line.from], b = pins[line.to];
      stringArtCtx.beginPath();
      stringArtCtx.moveTo(a.x, a.y);
      stringArtCtx.lineTo(b.x, b.y);
      stringArtCtx.stroke();
    }

    drawPinsAndLabels(stringArtCtx, stringArtCanvas, shape, pins);
  }

  if (originalColorImage && (exportType === "1" || exportType === "3")) {
    const originalImgData = originalColorImage.toDataURL('image/png');
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = imgWidth * canvas.height / canvas.width;
    const yOffset = (pageHeight - imgHeight) / 2;

    doc.setFontSize(16);
    doc.text("Ảnh Gốc - Huỳnh Văn Hưng", pageWidth / 2, margin, { align: "center" });
    doc.addImage(originalImgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
  }

  if (exportType === "1" || exportType === "3") {
    doc.addPage();
    const stringArtImgData = stringArtCanvas.toDataURL('image/png');
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = imgWidth * canvas.height / canvas.width;
    const yOffset = (pageHeight - imgHeight) / 2;

    doc.setFontSize(16);
    doc.text("Tranh Chỉ Số Hóa - Huỳnh Văn Hưng", pageWidth / 2, margin, { align: "center" });
    doc.addImage(stringArtImgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
  }

  if (exportType === "1" || exportType === "3") {
    const numbers = lines.slice(0, exportSteps).map(line => line.to);
    const numbersPerColumn = 50;
    const columnWidth = 20;
    const rowHeight = 5;
    const maxColumnsPerPage = Math.floor((pageWidth - 2 * margin) / columnWidth);

    let currentColumn = 0;
    let currentRow = 0;

    doc.addPage();
    doc.setFontSize(12);
    doc.text("Hướng Dẫn Tranh Chỉ - Mã Số", pageWidth / 2, margin, { align: "center" });

    numbers.forEach((number, index) => {
      const x = margin + currentColumn * columnWidth;
      const y = margin + 15 + currentRow * rowHeight;

      if (index % 10 === 0) {
        doc.setFont("times", "bold");
      } else {
        doc.setFont("times", "normal");
      }
      doc.text(number.toString(), x, y);

      currentRow++;
      if (currentRow >= numbersPerColumn) {
        currentRow = 0;
        currentColumn++;
        if (currentColumn >= maxColumnsPerPage && index < numbers.length - 1) {
          currentColumn = 0;
          doc.addPage();
          doc.setFontSize(12);
          doc.text("Hướng Dẫn Tranh Chỉ - Mã Số (Tiếp Theo)", pageWidth / 2, margin, { align: "center" });
        }
      }
    });
  }

  if (exportType === "2" || exportType === "3") {
    doc.addPage();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = "#fff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.strokeStyle = "#000000";
    tempCtx.lineWidth = 1;
    tempCtx.beginPath();
    tempCtx.moveTo(tempCanvas.width / 2, tempCanvas.height / 2 - 10);
    tempCtx.lineTo(tempCanvas.width / 2, tempCanvas.height / 2 + 10);
    tempCtx.moveTo(tempCanvas.width / 2 - 10, tempCanvas.height / 2);
    tempCtx.lineTo(tempCanvas.width / 2 + 10, tempCanvas.height / 2);
    tempCtx.stroke();

    drawPinsAndLabels(tempCtx, tempCanvas, shape, pins);

    const imgData = tempCanvas.toDataURL('image/png');
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = imgWidth * canvas.height / canvas.width;
    const yOffset = (pageHeight - imgHeight) / 2;

    doc.setFontSize(16);
    doc.text("Bản Vẽ Bố Trí Đinh - Huỳnh Văn Hưng", pageWidth / 2, margin, { align: "center" });
    doc.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
  }

  doc.save(`string-art-${paperSize}.pdf`);
  closeExportModal();
}

function downloadExcel() {
  if (lines.length === 0) {
    alert("Vui lòng tạo tranh trước khi xuất Excel!");
    return;
  }

  const maxSteps = lines.length;
  let exportSteps = prompt(`Nhập số bước muốn xuất (tối đa ${maxSteps}):`, maxSteps);
  exportSteps = parseInt(exportSteps);
  if (isNaN(exportSteps) || exportSteps <= 0 || exportSteps > maxSteps) {
    alert(`Số bước không hợp lệ! Vui lòng nhập số từ 1 đến ${maxSteps}.`);
    return;
  }

  const header = ["Bước", "Từ Đinh", "Tới Đinh"];
  const data = lines.slice(0, exportSteps).map((line, index) => [index + 1, line.from, line.to]);
  const csvContent = [header, ...data].map(row => row.join(",")).join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "huongdan-tranhchi.csv";
  link.click();
}

function enableStartButton() {
  if (!startBtn.disabled || currentStep < parseInt(document.getElementById('steps').value)) return;
  startBtn.disabled = false;
}

document.getElementById('pins').addEventListener('change', enableStartButton);
document.getElementById('steps').addEventListener('change', enableStartButton);
document.getElementById('shape').addEventListener('change', () => {
  updatePins();
  enableStartButton();
  redrawCanvas();
});
document.getElementById('paperSize').addEventListener('change', enableStartButton);

function openRealTimeModal() {
  if (lines.length === 0) {
    alert("Vui lòng tạo tranh trước khi xem vẽ thực tế!");
    return;
  }
  document.getElementById('realTimeModal').style.display = 'block';
  realTimeStep = 0;
  isRealTimePlaying = true;
  document.getElementById('playPauseBtn').textContent = 'Tạm dừng';
  document.getElementById('realTimeStepSlider').max = lines.length - 1;
  document.getElementById('realTimeStepSlider').value = 0;

  realTimeCanvas.width = canvas.width;
  realTimeCanvas.height = canvas.height;

  updateNumberMarquee();
  redrawRealTimeCanvas();
  startRealTimeDrawing();
}

function closeRealTimeModal() {
  document.getElementById('realTimeModal').style.display = 'none';
  clearInterval(realTimeInterval);
  realTimeInterval = null;
  isRealTimePlaying = false;
}

function updateNumberMarquee() {
  const marquee = document.getElementById('numberMarquee');
  marquee.innerHTML = '';
  const speed = parseFloat(document.getElementById('speedSlider').value);
  const animationDuration = speed;

  const activeSpan = document.createElement('span');
  activeSpan.textContent = lines[realTimeStep].to;
  activeSpan.classList.add('active');
  marquee.appendChild(activeSpan);

  for (let i = realTimeStep + 1; i <= Math.min(realTimeStep + 5, lines.length - 1); i++) {
    const span = document.createElement('span');
    span.textContent = lines[i].to;
    span.style.animation = `numberScroll ${animationDuration}s linear infinite`;
    marquee.appendChild(span);
  }

  document.getElementById('currentNumber').textContent = lines[realTimeStep].to;
  document.getElementById('stepText').innerHTML = `Bước <span>${realTimeStep + 1}</span>`;
  document.getElementById('realTimeStepValue').textContent = realTimeStep;
}

function startRealTimeDrawing() {
  if (realTimeInterval) clearInterval(realTimeInterval);
  const speed = parseFloat(document.getElementById('speedSlider').value) * 1000;
  realTimeInterval = setInterval(() => {
    if (isRealTimePlaying && realTimeStep < lines.length - 1) {
      realTimeStep++;
      document.getElementById('realTimeStepSlider').value = realTimeStep;
      updateNumberMarquee();
      redrawRealTimeCanvas();
    } else if (realTimeStep >= lines.length - 1) {
      clearInterval(realTimeInterval);
      isRealTimePlaying = false;
      document.getElementById('playPauseBtn').textContent = 'Phát lại';
    }
  }, speed);
}

function toggleRealTimePlay() {
  if (isRealTimePlaying) {
    clearInterval(realTimeInterval);
    isRealTimePlaying = false;
    document.getElementById('playPauseBtn').textContent = 'Tiếp tục';
  } else {
    if (realTimeStep >= lines.length - 1) {
      realTimeStep = 0;
      document.getElementById('realTimeStepSlider').value = 0;
    }
    isRealTimePlaying = true;
    document.getElementById('playPauseBtn').textContent = 'Tạm dừng';
    startRealTimeDrawing();
  }
}

document.getElementById('realTimeStepSlider').addEventListener('input', () => {
  realTimeStep = parseInt(document.getElementById('realTimeStepSlider').value);
  updateNumberMarquee();
  redrawRealTimeCanvas();
});

document.getElementById('speedSlider').addEventListener('input', () => {
  document.getElementById('speedValue').textContent = `${document.getElementById('speedSlider').value}s`;
  if (isRealTimePlaying) {
    startRealTimeDrawing();
  }
});

function toggleAdvancedRow() {
  const advancedRow = document.querySelector('.advanced-row h3');
  const advancedContent = document.querySelector('.advanced-content');
  advancedRow.classList.toggle('collapsed');
  advancedContent.classList.toggle('collapsed');
}

updateSliderValues();
