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
  pinInput.max = maxPins;
  if (parseInt(pinInput.value) > maxPins) pinInput.value = maxPins;

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
  pinPresets.value = pinOptions[0];
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
  const radius = Math.min(centerX, centerY) - 50;
  const points = [];
  for (let i = 0; i < pinCount; i++) {
    const angle = 2 * Math.PI * i / pinCount;
    let x, y;
    if (shape === 'circle') {
      x = centerX + radius * Math.cos(angle);
      y = centerY + radius * Math.sin(angle);
    } else if (shape === 'square') {
      x = centerX + radius * Math.sin(angle) * Math.abs(Math.cos(angle));
      y = centerY + radius * Math.cos(angle) * Math.abs(Math.sin(angle));
    } else if (shape === 'oval') {
      x = centerX + radius * 1.2 * Math.cos(angle);
      y = centerY + radius * 0.8 * Math.sin(angle);
    }
    points.push({ x, y });
  }
  return points;
}

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
    const radiusOffset = Math.min(canvas.width, canvas.height) / 2 - 30;
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    pins.forEach((pin, index) => {
      ctx.fillStyle = (index % 5 === 0) ? "#006400" : "#ff0000";
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, (index % 5 === 0) ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();

      const angle = Math.atan2(pin.y - canvas.height / 2, pin.x - canvas.width / 2);
      const labelX = canvas.width / 2 + radiusOffset * Math.cos(angle);
      const labelY = canvas.height / 2 + radiusOffset * Math.sin(angle);
      
      let displayNumber = "";
      if (index % 5 === 0 && index !== pins.length - 1) {
        displayNumber = index;
      }
      
      if (displayNumber !== "") {
        ctx.fillStyle = "#000";
        ctx.fillText(displayNumber, labelX, labelY);
      }
    });
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
    const pinCount = parseInt(document.getElementById('pins').value);
    const shape = document.getElementById('shape').value;
    pins = getPoints(pinCount, shape);
  }
  document.getElementById('togglePinsBtn').textContent = `Đinh: ${showPins ? 'Bật' : 'Tắt'}`;
  redrawCanvas();
}

function toggleLines() {
  showLines = !showLines;
  document.getElementById('toggleLinesBtn').textContent = `Chỉ: ${showLines ? 'Bật' : 'Tắt'}`;
  redrawCanvas();
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
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: paperSize.toLowerCase()
  });

  doc.setFont("times");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  if (exportType === "1" || exportType === "3") {
    const exportSteps = parseInt(document.getElementById('exportSteps').value);
    if (isNaN(exportSteps) || exportSteps <= 0 || exportSteps > lines.length) {
      alert(`Số bước không hợp lệ! Vui lòng nhập số từ 1 đến ${lines.length}.`);
      return;
    }

    const includeImage = document.getElementById('includeImage').checked;
    const numbers = lines.slice(0, exportSteps).map(line => line.to);
    const numbersPerColumn = 100;
    const columnsPerPage = 10;
    const numbersPerPage = numbersPerColumn * columnsPerPage;
    const totalPages = Math.ceil(numbers.length / numbersPerPage);

    if (includeImage) {
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', margin, margin + 10, pageWidth - 2 * margin, (pageWidth - 2 * margin) * canvas.height / canvas.width);
      doc.setFontSize(16);
      doc.text("Ứng Dụng Tranh Chỉ - Huỳnh Văn Hưng", pageWidth / 2, margin, { align: "center" });
      doc.addPage();
    }

    const columnWidth = (pageWidth - 2 * margin) / columnsPerPage;
    const rowHeight = 5;

    for (let page = 0; page < totalPages; page++) {
      if (page > 0 || (includeImage && page === 0)) doc.addPage();

      const startIndex = page * numbersPerPage;
      const endIndex = Math.min(startIndex + numbersPerPage, numbers.length);

      doc.setFontSize(12);
      doc.text("Hướng Dẫn Tranh Chỉ - Mã Số", pageWidth / 2, margin, { align: "center" });

      for (let i = startIndex; i < endIndex; i++) {
        const col = Math.floor((i - startIndex) / numbersPerColumn);
        const row = (i - startIndex) % numbersPerColumn;
        const x = margin + col * columnWidth + columnWidth / 2;
        const y = margin + 15 + row * rowHeight;

        if (row % 10 === 0) {
          doc.setFont("times", "bold");
        } else {
          doc.setFont("times", "normal");
        }
        doc.text(numbers[i].toString(), x, y, { align: "center" });
      }
    }

    if (exportType === "1") {
      doc.save(`string-art-numbers-${paperSize}.pdf`);
      closeExportModal();
      return;
    }
  }

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

  const radiusOffset = Math.min(tempCanvas.width, tempCanvas.height) / 2 - 30;
  tempCtx.font = "13px Arial";
  tempCtx.textAlign = "center";
  pins.forEach((pin, index) => {
    tempCtx.fillStyle = (index % 5 === 0) ? "#006400" : "#ff0000";
    tempCtx.beginPath();
    tempCtx.arc(pin.x, pin.y, (index % 5 === 0) ? 3 : 2, 0, Math.PI * 2);
    tempCtx.fill();

    const angle = Math.atan2(pin.y - tempCanvas.height / 2, pin.x - tempCanvas.width / 2);
    const labelX = tempCanvas.width / 2 + radiusOffset * Math.cos(angle);
    const labelY = tempCanvas.height / 2 + radiusOffset * Math.sin(angle);
    
    let displayNumber = "";
    if (index % 5 === 0 && index !== pins.length - 1) {
      displayNumber = index;
    }
    
    if (displayNumber !== "") {
      tempCtx.fillStyle = "#000";
      tempCtx.fillText(displayNumber, labelX, labelY);
    }
  });

  if (exportType === "3") doc.addPage();
  const imgData = tempCanvas.toDataURL('image/png');
  const scaleFactor = (pageWidth - 2 * margin) / tempCanvas.width;
  const pdfWidth = pageWidth - 2 * margin;
  const pdfHeight = tempCanvas.height * scaleFactor;

  doc.setFontSize(16);
  doc.text("Bản Vẽ Bố Trí Đinh - Huỳnh Văn Hưng", pageWidth / 2, margin, { align: "center" });
  doc.addImage(imgData, 'PNG', margin, margin + 10, pdfWidth, pdfHeight);

  doc.save(`string-art-${exportType === "2" ? "pin-layout" : "combined"}-${paperSize}.pdf`);
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
document.getElementById('shape').addEventListener('change', enableStartButton);
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
  updateNumberList();
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

function updateNumberList() {
  const numberList = document.getElementById('numberList');
  numberList.innerHTML = '';
  for (let i = 0; i < lines.length; i++) {
    const div = document.createElement('div');
    div.textContent = lines[i].to;
    if (i === realTimeStep) div.classList.add('active');
    numberList.appendChild(div);
  }
  const container = document.getElementById('numberListContainer');
  container.scrollTop = (realTimeStep - 5) * 18;
  document.getElementById('currentNumber').textContent = lines[realTimeStep].to;
  document.getElementById('stepText').innerHTML = `Bước <span>${realTimeStep + 1}</span>`;
  document.getElementById('realTimeStepValue').textContent = realTimeStep;
  redrawRealTimeCanvas();
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
}

function redrawRealTimeCanvas() {
  if (!realTimeCtx) return;
  realTimeCtx.clearRect(0, 0, realTimeCanvas.width, realTimeCanvas.height);
  realTimeCtx.fillStyle = "#fff";
  realTimeCtx.fillRect(0, 0, realTimeCanvas.width, realTimeCanvas.height);

  const scale = realTimeCanvas.width / canvas.width;
  realTimeCtx.strokeStyle = document.getElementById('threadColor').value;
  realTimeCtx.lineWidth = parseFloat(document.getElementById('threadWidth').value) * scale;

  const visibleLines = lines.slice(0, realTimeStep + 1);
  for (let line of visibleLines) {
    const a = pins[line.from], b = pins[line.to];
    realTimeCtx.beginPath();
    realTimeCtx.moveTo(a.x * scale, a.y * scale);
    realTimeCtx.lineTo(b.x * scale, b.y * scale);
    realTimeCtx.stroke();
  }

  realTimeCtx.fillStyle = "#ff0000";
  pins.forEach(pin => {
    realTimeCtx.beginPath();
    realTimeCtx.arc(pin.x * scale, pin.y * scale, 2 * scale, 0, Math.PI * 2);
    realTimeCtx.fill();
  });
}

function startRealTimeDrawing() {
  if (realTimeInterval) clearInterval(realTimeInterval);
  const speed = parseFloat(document.getElementById('speedSlider').value) * 1000;
  realTimeInterval = setInterval(() => {
    if (isRealTimePlaying && realTimeStep < lines.length - 1) {
      realTimeStep++;
      document.getElementById('realTimeStepSlider').value = realTimeStep;
      updateNumberList();
      updateNumberMarquee();
    } else if (realTimeStep >= lines.length - 1) {
      clearInterval(realTimeInterval);
      realTimeInterval = null;
      isRealTimePlaying = false;
      document.getElementById('playPauseBtn').textContent = 'Bắt đầu';
    }
  }, speed);
}

function toggleRealTimePlay() {
  isRealTimePlaying = !isRealTimePlaying;
  document.getElementById('playPauseBtn').textContent = isRealTimePlaying ? 'Tạm dừng' : 'Bắt đầu';
  if (isRealTimePlaying) startRealTimeDrawing();
  else clearInterval(realTimeInterval);
}

document.getElementById('speedSlider').addEventListener('input', () => {
  const speed = document.getElementById('speedSlider').value;
  document.getElementById('speedValue').textContent = `${speed}s`;
  if (isRealTimePlaying) startRealTimeDrawing();
  updateNumberMarquee();
});

document.getElementById('realTimeStepSlider').addEventListener('input', () => {
  realTimeStep = parseInt(document.getElementById('realTimeStepSlider').value);
  updateNumberList();
  updateNumberMarquee();
});

const numberListContainer = document.getElementById('numberListContainer');
let isDraggingList = false;
let startY, scrollTop;

numberListContainer.addEventListener('mousedown', (e) => {
  isDraggingList = true;
  startY = e.pageY - numberListContainer.offsetTop;
  scrollTop = numberListContainer.scrollTop;
});

numberListContainer.addEventListener('mousemove', (e) => {
  if (!isDraggingList) return;
  e.preventDefault();
  const y = e.pageY - numberListContainer.offsetTop;
  const walk = (startY - y) * 2;
  numberListContainer.scrollTop = scrollTop + walk;
  const newStep = Math.floor(numberListContainer.scrollTop / 18) + 5;
  if (newStep >= 0 && newStep < lines.length && newStep !== realTimeStep) {
    realTimeStep = newStep;
    document.getElementById('realTimeStepSlider').value = realTimeStep;
    updateNumberList();
    updateNumberMarquee();
  }
});

numberListContainer.addEventListener('mouseup', () => {
  isDraggingList = false;
});

numberListContainer.addEventListener('mouseleave', () => {
  isDraggingList = false;
});

numberListContainer.addEventListener('touchstart', (e) => {
  isDraggingList = true;
  startY = e.touches[0].pageY - numberListContainer.offsetTop;
  scrollTop = numberListContainer.scrollTop;
});

numberListContainer.addEventListener('touchmove', (e) => {
  if (!isDraggingList) return;
  e.preventDefault();
  const y = e.touches[0].pageY - numberListContainer.offsetTop;
  const walk = (startY - y) * 2;
  numberListContainer.scrollTop = scrollTop + walk;
  const newStep = Math.floor(numberListContainer.scrollTop / 18) + 5;
  if (newStep >= 0 && newStep < lines.length && newStep !== realTimeStep) {
    realTimeStep = newStep;
    document.getElementById('realTimeStepSlider').value = realTimeStep;
    updateNumberList();
    updateNumberMarquee();
  }
});

numberListContainer.addEventListener('touchend', () => {
  isDraggingList = false;
});

function toggleAdvancedRow() {
  const header = document.querySelector('.advanced-row h3');
  const content = document.querySelector('.advanced-content');
  header.classList.toggle('collapsed');
  content.classList.toggle('collapsed');
}

window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("data");
  if (encoded) {
    try {
      const data = JSON.parse(atob(encoded));
      pins = data.pins || [];
      lines = data.lines || [];
      document.getElementById('threadColor').value = data.threadColor || "#000000";
      document.getElementById('threadWidth').value = data.threadWidth || "0.1";
      document.getElementById('pins').value = data.pinCount || 200;
      document.getElementById('steps').value = data.steps || 800;
      document.getElementById('shape').value = data.shape || "circle";
      document.getElementById('paperSize').value = data.paperSize || "Default";
      updateCanvasSize();
      redrawCanvas();
      stepSlider.max = lines.length;
      stepSlider.value = lines.length;
      stepSlider.disabled = lines.length === 0;
      updateSliderValues();
    } catch (e) {
      console.error("Lỗi khi đọc dữ liệu:", e);
    }
  } else {
    updateCanvasSize();
  }
  updateSliderValues();
});
