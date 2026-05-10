Виправлений архів симулятора.

Запуск:
1) Відкрий кореневий index.html через Live Server.
2) Або відкрий dist/index.html — він теж перенаправлений на актуальні файли web/.
3) Після заміни зроби Ctrl+F5.

Що виправлено:
- src/ui/asmCompiler.ts і web/ui/asmCompiler.js:
  DAT EQU 0x20 / ADR EQU 0x21 тепер працюють як direct RAM адреси.
  MOV DAT,#0x31 -> 75 20 31
  MOV A,DAT     -> E5 20
- src/vm/emu8051Wasm.ts і web/vm/emu8051Wasm.js:
  Intel HEX більше не обрізає адреси до 8 біт.
- src/vm/emuBoardController.ts і web/vm/emuBoardController.js:
  loadHex завантажує байти в ROM по 16-бітних адресах.
- dist/index.html:
  відкриває актуальний web/main.js, а не старий bundle.

Перевірка компілятора:
DAT EQU 0x20
ADR EQU 0x21
ORG 0x0000
MOV DAT,#0x31
MOV ADR,#0x08
MOV A,DAT
MOV P0,A
MOV A,ADR
MOV P2,A
END

Очікуваний HEX:
:0E000000752031752108E520F580E521F5A079
:00000001FF
