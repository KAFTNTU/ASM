export const exampleScripts = [
    {
        id: "lab1-led-scan",
        title: "Lab1: LED line (addr 0x07)",
        description: "Пише в latch 0x07 і біжить активним бітом по LED-лінійці в active-low режимі.",
        code: `export async function main({ board }) {
  let a = 0x01;
  while (true) {
    a = ((a >>> 1) | ((a & 1) << 7)) & 0xff;

    board.writeBit('P3', 6, 1);
    board.writePort('P0', (~a) & 0xff);
    board.writePort('P2', 0x07);
    board.writePort('P2', 0x00);

    await board.delay(180);
  }
}
`,
    },
    {
        id: "lab2-7seg-1988",
        title: "Lab2: 7-seg static 1988",
        description: "Записує 1-9-8-8 у чотири цифри семисегментника через адреси 0x01..0x04.",
        code: `export async function main({ board }) {
  const digits = [
    { addr: 0x04, dat: 0b11001111 },
    { addr: 0x03, dat: 0b10010000 },
    { addr: 0x02, dat: 0b10000000 },
    { addr: 0x01, dat: 0b10000000 },
  ];

  board.writeBit('P3', 6, 1);
  for (const addr of [0x01, 0x02, 0x03, 0x04]) {
    board.writePort('P0', 0xff);
    board.writePort('P2', addr);
    board.writePort('P2', 0x00);
  }

  while (true) {
    for (const { addr, dat } of digits) {
      board.writeBit('P3', 6, 1);
      board.writePort('P0', dat);
      board.writePort('P2', addr);
      board.writePort('P2', 0x00);
      await board.delay(450);
    }
  }
}
`,
    },
    {
        id: "lab3-matrix-s",
        title: "Lab3: Matrix letter S",
        description: "Сканує 5x7 матрицю через 0x05/0x06 і тримає видиму букву S через мультиплексування.",
        code: `export async function main({ board }) {
  const frames = [
    { row: 0b10111110, col: 0b00001110 },
    { row: 0b11011101, col: 0b00010001 },
    { row: 0b11111011, col: 0b00010000 },
    { row: 0b11101111, col: 0b00000001 },
    { row: 0b11011101, col: 0b00010001 },
    { row: 0b10111110, col: 0b00001110 },
  ];

  while (true) {
    for (const f of frames) {
      board.writeBit('P3', 6, 1);
      board.writePort('P0', f.row);
      board.writePort('P2', 0x05);
      board.writePort('P2', 0x00);

      board.writePort('P0', f.col);
      board.writePort('P2', 0x06);
      board.writePort('P2', 0x00);
      await board.delay(8);
    }
  }
}
`,
    },
    {
        id: "lab4-keypad-led",
        title: "Lab4: Keypad to LED line",
        description: "Сканує клавіатуру через 0x60 / 0x50 / 0x30 і підсвічує окремий LED під натиснуту кнопку.",
        code: `export async function main({ board }) {
  const colAddrs = [0x60, 0x50, 0x30];
  while (true) {
    for (let col = 0; col < 3; col++) {
      board.writePort('P2', colAddrs[col]);
      board.writeBit('P3', 6, 0);
      const p0 = board.readPort('P0');
      const rows = (~p0) & 0x0f;

      if (rows) {
        let row = 0;
        while (((rows >>> row) & 1) === 0) row++;
        const ledIndex = col * 3 + row;
        const mask = 1 << (ledIndex % 8);

        board.writeBit('P3', 6, 1);
        board.writePort('P0', (~mask) & 0xff);
        board.writePort('P2', 0x07);
        board.writePort('P2', 0x00);
      }

      await board.delay(40);
    }
  }
}
`,
    },
    {
        id: "lab5-lcd-hello",
        title: "Lab5: LCD hello",
        description: "Простий high-level приклад для LCD: очищення, два рядки тексту і курсор у різні позиції.",
        code: `export async function main({ devices }) {
  devices.lcd.clear();
  devices.lcd.print(0, 0, "TNTU ST841");
  devices.lcd.print(1, 0, "LCD OK");
  devices.lcd.print(2, 0, "Line 3");
  devices.lcd.print(3, 1, "Ready");
}
`,
    },
    {
        id: "lab6-adc-joystick",
        title: "Lab6: ADC joystick",
        description: "Читає X/Y джойстика і малює точку на 5x7 матриці як візуалізацію АЦП.",
        code: `export async function main({ devices }) {
  while (true) {
    const { x, y } = devices.adc.read();
    const col = Math.min(4, Math.max(0, Math.round((x / 1023) * 4)));
    const row = Math.min(6, Math.max(0, Math.round((y / 1023) * 6)));
    devices.matrix.setPoint(row, col, true);
    await new Promise((r) => setTimeout(r, 40));
  }
}
`,
    },
    {
        id: "lab7-motor-preview",
        title: "Lab7: Motor preview",
        description: "High-level демо: швидкість двигуна залежить від X-положення джойстика.",
        code: `export async function main({ devices }) {
  while (true) {
    const { x } = devices.adc.read();
    const duty = Math.max(0.05, Math.min(0.95, x / 1023));
    devices.motor.setPwmState({
      active: true,
      mode: 1,
      duty,
      frequencyHz: 650,
      periodCounts: 4096,
      compareCounts: Math.round(4096 * duty),
      sourceLabel: "script",
      dividerLabel: "/1",
    });
    await new Promise((r) => setTimeout(r, 40));
  }
}
`,
    },
    {
        id: "lab8-audio-preview",
        title: "Lab8: Audio preview",
        description: "High-level демо: прямокутний аудіосигнал із паузою між каналами.",
        code: `export async function main({ devices }) {
  let tick = 0;
  while (true) {
    devices.audio.setState({
      daccon: 0x03,
      dac0: 0x0fff,
      dac1: 0x0000,
      p34: 1,
      p35: 1,
      tick: tick += 512,
    });
    await new Promise((r) => setTimeout(r, 25));
    devices.audio.setState({
      daccon: 0x03,
      dac0: 0x0000,
      dac1: 0x0fff,
      p34: 1,
      p35: 1,
      tick: tick += 512,
    });
    await new Promise((r) => setTimeout(r, 25));
  }
}
`,
    },
];
