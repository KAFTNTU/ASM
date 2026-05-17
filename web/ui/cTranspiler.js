const REGISTER_NAMES = new Set([
    "a", "acc", "b", "p0", "p1", "p2", "p3", "sp", "dpl", "dph",
    "tl0", "th0", "tl1", "th1", "tcon", "tmod", "psw", "ie", "ip", "scon", "sbuf",
]);
const BUILTIN_RETURN_CALLS = new Set([
    "read_adc", "adc_read", "adc_high", "read_adc_high",
    "adc_low", "read_adc_low",
    "joystick_x", "joy_x", "joystick_y", "joy_y",
    "keypad_read", "key_read", "readkey", "read_key", "keypad_col1", "keypad_col2", "keypad_col3",
    "getadc", "get_adc", "adc", "readadc",
]);
const BUILTIN_VOID_CALLS = new Set([
    "write", "st_write", "bus_write", "delay", "sleep", "delay_ms", "nop", "_nop_",
    "led", "leds", "led_line", "led_bar", "led_off", "leds_off", "led_all", "leds_all", "led_on",
    "seg", "sevenseg", "seven_seg", "seg_digit", "sevenseg_digit", "digit", "seg_clear", "sevenseg_clear",
    "matrix", "matrix_write", "matrix_rows", "matrix_cols",
    "lcd_cmd", "lcd_command", "lcd_data", "lcd_char", "lcd_putc", "lcd_clear", "lcd_home",
    "lcd_init", "lcd_line", "lcd_puts", "lcd_print",
    "clear_latches", "clearlatches", "clearstatic", "clear_static",
    "static", "staticl", "statich", "step", "stepv", "motor", "stepper"
]);
// ST841 / 74HC574 seven-segment table from the lab manual.
// Bit order: PGFEDCBA, active-low: 0 lights a segment, 1 turns it off.
const DIGIT_TO_SEG = [
    0xC0, // 0
    0xF9, // 1
    0xA4, // 2
    0xB0, // 3
    0x99, // 4
    0x92, // 5
    0x82, // 6
    0xF8, // 7
    0x80, // 8
    0x98, // 9
    0x88, // A
    0x83, // b
    0xC6, // C
    0xA1, // d
    0x86, // E
    0x8E, // F
];

const METHODYCHKA_PACK3_REGRESSION_CATALOG = [
    {"lab": 2, "id": "lab2_technical_case_001", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 1 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_002", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 2 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_003", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 3 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_004", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 4 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_005", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 5 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_006", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 6 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_007", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 7 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_008", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 8 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_009", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 9 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_010", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 10 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_011", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 11 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_012", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 12 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_013", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 13 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_014", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 14 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_015", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 15 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_016", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 16 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_017", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 17 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_018", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 18 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_019", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 19 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_020", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 20 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_021", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 21 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_022", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 22 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_023", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 23 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_024", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 24 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_025", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 25 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_026", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 26 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_027", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 27 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_028", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 28 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_029", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 29 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_030", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 30 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_031", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 31 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_032", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 32 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_033", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 33 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_034", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 34 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_035", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 35 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_036", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 36 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_037", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 37 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_038", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 38 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_039", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 39 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_040", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 40 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_041", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 41 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_042", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 42 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_043", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 43 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_044", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 44 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_045", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 45 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_046", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 46 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_047", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 47 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_048", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 48 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_049", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 49 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_050", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 50 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_051", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 51 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_052", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 52 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_053", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 53 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_054", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 54 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_055", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 55 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_056", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 56 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_057", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 57 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_058", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 58 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_059", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 59 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_060", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 60 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_061", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 61 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_062", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 62 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_063", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 63 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_064", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 64 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_065", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 65 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_066", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 66 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_067", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 67 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_068", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 68 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_069", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 69 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_070", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 70 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_071", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 71 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_072", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 72 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_073", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 73 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_074", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 74 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_075", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 75 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_076", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 76 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_077", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 77 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_078", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 78 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_079", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 79 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_080", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 80 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_081", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 81 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_082", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 82 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_083", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 83 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_084", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 84 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_085", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 85 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_086", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 86 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_087", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 87 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_088", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 88 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_089", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 89 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_090", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 90 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_091", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 91 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_092", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 92 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_093", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 93 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_094", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 94 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_095", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 95 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_096", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 96 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_097", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 97 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_098", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 98 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_099", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 99 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_100", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 100 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_101", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 101 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_102", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 102 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_103", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 103 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_104", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 104 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_105", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 105 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_106", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 106 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_107", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 107 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_108", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 108 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_109", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 109 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_110", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 110 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_111", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 111 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_112", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 112 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_113", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 113 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_114", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 114 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_115", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 115 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_116", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 116 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_117", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 117 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_118", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 118 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_119", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 119 for lab 2"},
    {"lab": 2, "id": "lab2_technical_case_120", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 120 for lab 2"},
    {"lab": 3, "id": "lab3_technical_case_001", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 1 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_002", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 2 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_003", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 3 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_004", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 4 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_005", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 5 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_006", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 6 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_007", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 7 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_008", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 8 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_009", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 9 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_010", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 10 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_011", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 11 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_012", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 12 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_013", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 13 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_014", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 14 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_015", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 15 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_016", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 16 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_017", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 17 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_018", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 18 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_019", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 19 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_020", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 20 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_021", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 21 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_022", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 22 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_023", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 23 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_024", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 24 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_025", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 25 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_026", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 26 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_027", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 27 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_028", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 28 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_029", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 29 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_030", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 30 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_031", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 31 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_032", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 32 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_033", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 33 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_034", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 34 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_035", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 35 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_036", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 36 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_037", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 37 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_038", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 38 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_039", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 39 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_040", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 40 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_041", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 41 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_042", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 42 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_043", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 43 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_044", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 44 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_045", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 45 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_046", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 46 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_047", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 47 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_048", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 48 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_049", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 49 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_050", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 50 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_051", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 51 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_052", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 52 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_053", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 53 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_054", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 54 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_055", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 55 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_056", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 56 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_057", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 57 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_058", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 58 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_059", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 59 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_060", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 60 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_061", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 61 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_062", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 62 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_063", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 63 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_064", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 64 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_065", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 65 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_066", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 66 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_067", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 67 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_068", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 68 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_069", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 69 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_070", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 70 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_071", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 71 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_072", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 72 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_073", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 73 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_074", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 74 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_075", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 75 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_076", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 76 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_077", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 77 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_078", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 78 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_079", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 79 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_080", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 80 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_081", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 81 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_082", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 82 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_083", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 83 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_084", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 84 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_085", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 85 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_086", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 86 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_087", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 87 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_088", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 88 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_089", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 89 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_090", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 90 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_091", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 91 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_092", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 92 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_093", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 93 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_094", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 94 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_095", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 95 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_096", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 96 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_097", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 97 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_098", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 98 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_099", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 99 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_100", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 100 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_101", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 101 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_102", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 102 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_103", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 103 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_104", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 104 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_105", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 105 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_106", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 106 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_107", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 107 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_108", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 108 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_109", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 109 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_110", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 110 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_111", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 111 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_112", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 112 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_113", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 113 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_114", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 114 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_115", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 115 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_116", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 116 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_117", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 117 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_118", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 118 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_119", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 119 for lab 3"},
    {"lab": 3, "id": "lab3_technical_case_120", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 120 for lab 3"},
    {"lab": 4, "id": "lab4_technical_case_001", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 1 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_002", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 2 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_003", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 3 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_004", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 4 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_005", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 5 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_006", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 6 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_007", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 7 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_008", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 8 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_009", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 9 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_010", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 10 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_011", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 11 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_012", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 12 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_013", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 13 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_014", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 14 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_015", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 15 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_016", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 16 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_017", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 17 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_018", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 18 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_019", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 19 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_020", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 20 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_021", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 21 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_022", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 22 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_023", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 23 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_024", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 24 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_025", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 25 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_026", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 26 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_027", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 27 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_028", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 28 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_029", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 29 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_030", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 30 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_031", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 31 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_032", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 32 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_033", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 33 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_034", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 34 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_035", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 35 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_036", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 36 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_037", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 37 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_038", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 38 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_039", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 39 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_040", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 40 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_041", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 41 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_042", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 42 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_043", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 43 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_044", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 44 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_045", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 45 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_046", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 46 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_047", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 47 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_048", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 48 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_049", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 49 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_050", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 50 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_051", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 51 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_052", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 52 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_053", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 53 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_054", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 54 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_055", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 55 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_056", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 56 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_057", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 57 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_058", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 58 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_059", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 59 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_060", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 60 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_061", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 61 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_062", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 62 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_063", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 63 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_064", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 64 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_065", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 65 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_066", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 66 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_067", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 67 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_068", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 68 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_069", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 69 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_070", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 70 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_071", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 71 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_072", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 72 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_073", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 73 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_074", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 74 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_075", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 75 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_076", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 76 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_077", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 77 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_078", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 78 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_079", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 79 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_080", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 80 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_081", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 81 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_082", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 82 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_083", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 83 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_084", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 84 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_085", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 85 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_086", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 86 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_087", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 87 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_088", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 88 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_089", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 89 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_090", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 90 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_091", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 91 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_092", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 92 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_093", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 93 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_094", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 94 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_095", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 95 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_096", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 96 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_097", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 97 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_098", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 98 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_099", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 99 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_100", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 100 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_101", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 101 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_102", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 102 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_103", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 103 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_104", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 104 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_105", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 105 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_106", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 106 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_107", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 107 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_108", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 108 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_109", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 109 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_110", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 110 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_111", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 111 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_112", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 112 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_113", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 113 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_114", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 114 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_115", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 115 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_116", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 116 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_117", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 117 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_118", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 118 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_119", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 119 for lab 4"},
    {"lab": 4, "id": "lab4_technical_case_120", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 120 for lab 4"},
    {"lab": 5, "id": "lab5_technical_case_001", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 1 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_002", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 2 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_003", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 3 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_004", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 4 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_005", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 5 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_006", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 6 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_007", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 7 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_008", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 8 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_009", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 9 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_010", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 10 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_011", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 11 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_012", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 12 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_013", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 13 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_014", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 14 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_015", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 15 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_016", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 16 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_017", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 17 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_018", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 18 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_019", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 19 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_020", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 20 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_021", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 21 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_022", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 22 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_023", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 23 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_024", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 24 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_025", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 25 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_026", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 26 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_027", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 27 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_028", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 28 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_029", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 29 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_030", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 30 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_031", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 31 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_032", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 32 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_033", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 33 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_034", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 34 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_035", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 35 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_036", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 36 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_037", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 37 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_038", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 38 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_039", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 39 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_040", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 40 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_041", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 41 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_042", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 42 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_043", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 43 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_044", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 44 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_045", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 45 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_046", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 46 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_047", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 47 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_048", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 48 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_049", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 49 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_050", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 50 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_051", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 51 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_052", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 52 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_053", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 53 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_054", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 54 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_055", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 55 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_056", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 56 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_057", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 57 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_058", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 58 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_059", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 59 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_060", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 60 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_061", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 61 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_062", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 62 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_063", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 63 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_064", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 64 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_065", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 65 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_066", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 66 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_067", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 67 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_068", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 68 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_069", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 69 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_070", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 70 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_071", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 71 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_072", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 72 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_073", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 73 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_074", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 74 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_075", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 75 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_076", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 76 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_077", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 77 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_078", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 78 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_079", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 79 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_080", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 80 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_081", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 81 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_082", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 82 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_083", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 83 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_084", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 84 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_085", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 85 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_086", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 86 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_087", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 87 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_088", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 88 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_089", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 89 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_090", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 90 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_091", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 91 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_092", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 92 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_093", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 93 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_094", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 94 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_095", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 95 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_096", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 96 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_097", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 97 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_098", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 98 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_099", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 99 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_100", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 100 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_101", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 101 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_102", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 102 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_103", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 103 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_104", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 104 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_105", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 105 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_106", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 106 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_107", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 107 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_108", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 108 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_109", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 109 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_110", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 110 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_111", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 111 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_112", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 112 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_113", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 113 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_114", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 114 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_115", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 115 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_116", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 116 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_117", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 117 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_118", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 118 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_119", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 119 for lab 5"},
    {"lab": 5, "id": "lab5_technical_case_120", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 120 for lab 5"},
    {"lab": 6, "id": "lab6_technical_case_001", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 1 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_002", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 2 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_003", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 3 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_004", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 4 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_005", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 5 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_006", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 6 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_007", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 7 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_008", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 8 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_009", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 9 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_010", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 10 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_011", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 11 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_012", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 12 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_013", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 13 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_014", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 14 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_015", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 15 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_016", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 16 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_017", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 17 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_018", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 18 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_019", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 19 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_020", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 20 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_021", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 21 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_022", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 22 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_023", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 23 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_024", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 24 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_025", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 25 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_026", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 26 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_027", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 27 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_028", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 28 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_029", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 29 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_030", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 30 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_031", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 31 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_032", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 32 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_033", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 33 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_034", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 34 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_035", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 35 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_036", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 36 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_037", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 37 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_038", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 38 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_039", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 39 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_040", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 40 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_041", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 41 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_042", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 42 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_043", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 43 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_044", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 44 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_045", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 45 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_046", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 46 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_047", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 47 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_048", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 48 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_049", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 49 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_050", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 50 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_051", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 51 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_052", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 52 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_053", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 53 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_054", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 54 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_055", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 55 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_056", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 56 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_057", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 57 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_058", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 58 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_059", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 59 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_060", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 60 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_061", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 61 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_062", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 62 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_063", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 63 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_064", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 64 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_065", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 65 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_066", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 66 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_067", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 67 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_068", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 68 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_069", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 69 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_070", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 70 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_071", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 71 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_072", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 72 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_073", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 73 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_074", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 74 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_075", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 75 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_076", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 76 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_077", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 77 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_078", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 78 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_079", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 79 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_080", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 80 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_081", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 81 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_082", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 82 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_083", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 83 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_084", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 84 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_085", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 85 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_086", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 86 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_087", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 87 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_088", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 88 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_089", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 89 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_090", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 90 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_091", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 91 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_092", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 92 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_093", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 93 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_094", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 94 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_095", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 95 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_096", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 96 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_097", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 97 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_098", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 98 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_099", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 99 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_100", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 100 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_101", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 101 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_102", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 102 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_103", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 103 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_104", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 104 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_105", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 105 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_106", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 106 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_107", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 107 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_108", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 108 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_109", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 109 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_110", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 110 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_111", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 111 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_112", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 112 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_113", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 113 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_114", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 114 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_115", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 115 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_116", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 116 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_117", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 117 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_118", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 118 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_119", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 119 for lab 6"},
    {"lab": 6, "id": "lab6_technical_case_120", "covers": ["Keil C", "ST841", "ADuC841"], "note": "Synthetic regression/spec hook 120 for lab 6"}
];

export function transpileCToAsm(source) {
    const diagnostics = [];
    const text = methodychkaNormalizeSource(stripComments(source).replace(/\r/g, ""));
    const ctx = {
        diagnostics,
        constants: parseDefines(text),
        sfr: parseSfr(text),
        sbit: parseSbits(text),
        vars: new Map(),
        functions: parseFunctions(text),
        labels: 0,
        needDelay: false,
        needWrite: false,
        needReadAdc: false,
        needReadAdcLow: false,
        needKeypadRead: false,
        needLcd: false,
        needLedOn: false,
        needSegDigit: false,
        needMethodKey: false,
        needStepper: false,
        needStaticDisplay: false,
        arrays: parseCodeArrays(text),
        breakStack: [],
        continueStack: [],
    };
    parseGlobalVars(text, ctx);
    if (!ctx.functions.has("main")) {
        return { ok: false, asm: "", diagnostics };
    }
    const emitted = [];
    emitted.push("org 0x0000");
    emitted.push("c_start:");
    emitted.push("mov sp,#0x2f");
    emitted.push("call main");
    emitted.push("c_stop:");
    emitted.push("sjmp c_stop");
    emitted.push("");
    emitFunction("main", ctx, emitted, new Set());
    for (const name of ctx.functions.keys()) {
        if (name !== "main" && !BUILTIN_VOID_CALLS.has(name) && !BUILTIN_RETURN_CALLS.has(name))
            emitFunction(name, ctx, emitted, new Set());
    }
    if (ctx.needWrite || ctx.needLcd || ctx.needLedOn || ctx.needSegDigit)
        emitWriteRoutine(emitted);
    if (ctx.needReadAdc)
        emitReadAdcRoutine(emitted);
    if (ctx.needReadAdcLow)
        emitReadAdcLowRoutine(emitted);
    if (ctx.needKeypadRead)
        emitKeypadReadRoutine(emitted);
    if (ctx.needLcd)
        emitLcdRoutine(emitted);
    if (ctx.needLedOn)
        emitLedOnRoutine(emitted);
    if (ctx.needSegDigit)
        emitSegDigitRoutine(emitted);
    if (ctx.needMethodKey)
        emitMethodReadKeyRoutine(emitted);
    if (ctx.needStepper)
        emitStepperRoutine(emitted);
    if (ctx.needStaticDisplay)
        emitStaticDisplayRoutine(emitted);
    if (ctx.arrayRoutines)
        emitArrayRoutines(emitted, ctx.arrayRoutines);
    if (ctx.needDelay)
        emitDelayRoutine(emitted);
    emitted.push("end");
    if (!diagnostics.some((item) => item.level === "error")) {
        diagnostics.push({
            level: "hint",
            message: "C Keil/ST841 Pack3 subset: include/prototypes, sfr/sbit, code/data arrays, string arrays, params, return, if/else, switch/case/default, while/do/for, break/continue, ternary, sizeof, basic pointer syntax warning, LED/7seg/matrix/LCD/keypad/stepper/ADC helpers.",
        });
    }
    return { ok: diagnostics.every((item) => item.level !== "error"), asm: emitted.join("\n"), diagnostics };
}
function emitFunction(name, ctx, out, seen) {
    if (seen.has(name))
        return;
    const fn = ctx.functions.get(name);
    if (!fn)
        return;
    seen.add(name);
    for (const param of (fn.params ?? [])) {
        allocVar(param.name, ctx, param.size);
    }
    out.push(`${sanitizeLabel(name)}:`);
    emitStatements(splitStatements(fn.body), fn.lineOffset, ctx, out);
    out.push("ret");
    out.push("");
}
function emitStatements(stmts, lineOffset, ctx, out) {
    for (const stmt of stmts)
        emitStatement(stmt, lineOffset, ctx, out);
}
function emitStatement(statement, lineOffset, ctx, out) {
    const raw = trimOuter(statement.text.trim());
    if (!raw)
        return;
    const line = lineOffset + statement.line;
    if (/^break\s*;?$/i.test(raw)) {
        const target = ctx.breakStack?.[ctx.breakStack.length - 1];
        if (target) emitLongJump(target, out);
        else ctx.diagnostics.push({ level: "warning", line, message: "break використано поза циклом/switch." });
        return;
    }
    if (/^continue\s*;?$/i.test(raw)) {
        const target = ctx.continueStack?.[ctx.continueStack.length - 1];
        if (target) emitLongJump(target, out);
        else ctx.diagnostics.push({ level: "warning", line, message: "continue використано поза циклом." });
        return;
    }
    const doWhile = /^do\s*\{([\s\S]*)\}\s*while\s*\(([^)]*)\)\s*;?$/i.exec(raw);
    if (doWhile) {
        const start = nextLabel(ctx, "do");
        const end = nextLabel(ctx, "doend");
        ctx.breakStack.push(end);
        ctx.continueStack.push(start);
        out.push(`${start}:`);
        emitStatements(splitStatements(doWhile[1]), lineOffset + statement.line, ctx, out);
        emitConditionJumpFalse(doWhile[2], end, line, ctx, out);
        emitLongJump(start, out);
        out.push(`${end}:`);
        ctx.breakStack.pop();
        ctx.continueStack.pop();
        return;
    }
    const switchMatch = /^switch\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (switchMatch) {
        emitSwitch(switchMatch[1], switchMatch[2], line, lineOffset + statement.line, ctx, out);
        return;
    }
    const forGeneric = /^for\s*\(([^;]*);([^;]*);([^)]*)\)\s*(?:\{([\s\S]*)\}|([\s\S]*))$/i.exec(raw);
    if (forGeneric) {
        const init = forGeneric[1].trim();
        const cond = forGeneric[2].trim();
        const incExpr = forGeneric[3].trim();
        const body = (forGeneric[4] != null ? forGeneric[4] : forGeneric[5] || "").trim();
        if (init) emitStatement({ text: init.endsWith(";") ? init : init + ";", line: statement.line }, lineOffset, ctx, out);
        const start = nextLabel(ctx, "for");
        const cont = nextLabel(ctx, "forcont");
        const end = nextLabel(ctx, "forend");
        out.push(`${start}:`);
        if (cond) emitConditionJumpFalse(cond, end, line, ctx, out);
        ctx.breakStack.push(end);
        ctx.continueStack.push(cont);
        if (body && body !== ";") emitStatements(splitStatements(body), lineOffset + statement.line, ctx, out);
        out.push(`${cont}:`);
        if (incExpr) emitStatement({ text: incExpr.endsWith(";") ? incExpr : incExpr + ";", line: statement.line }, lineOffset, ctx, out);
        emitLongJump(start, out);
        out.push(`${end}:`);
        ctx.breakStack.pop();
        ctx.continueStack.pop();
        return;
    }
    const whileOne = /^while\s*\(\s*(?:1|true)\s*\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (whileOne) {
        const label = nextLabel(ctx, "while");
        out.push(`${label}:`);
        emitStatements(splitStatements(whileOne[1]), lineOffset + statement.line, ctx, out);
        emitLongJump(label, out);
        return;
    }
    const whileCond = /^while\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (whileCond) {
        const start = nextLabel(ctx, "while");
        const end = nextLabel(ctx, "wend");
        out.push(`${start}:`);
        emitConditionJumpFalse(whileCond[1], end, line, ctx, out);
        emitStatements(splitStatements(whileCond[2]), lineOffset + statement.line, ctx, out);
        emitLongJump(start, out);
        out.push(`${end}:`);
        return;
    }
    const forCount = /^for\s*\(\s*(?:unsigned\s+char\s+|unsigned\s+int\s+|int\s+|uint8_t\s+|char\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+);\s*\1\s*<\s*([^;]+);\s*\1\s*\+\+\s*\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (forCount) {
        const varName = forCount[1];
        const start = parseValue(forCount[2], ctx);
        const end = parseValue(forCount[3], ctx);
        if (start == null || end == null || end <= start || end - start > 255) {
            ctx.diagnostics.push({ level: "warning", line, message: `C for-loop skipped або занадто великий: ${raw.slice(0, 70)}` });
            return;
        }
        const loop = nextLabel(ctx, "for");
        const counter = allocVar(varName, ctx).addr;
        out.push(`mov ${hexByte(counter)},#${hexByte(end - start)}`);
        out.push(`${loop}:`);
        emitStatements(splitStatements(forCount[4]), lineOffset + statement.line, ctx, out);
        const again = nextLabel(ctx, "foragain");
        const done = nextLabel(ctx, "forend");
        out.push(`djnz ${hexByte(counter)},${again}`);
        emitLongJump(done, out);
        out.push(`${again}:`);
        emitLongJump(loop, out);
        out.push(`${done}:`);
        return;
    }
    const ifMatch = /^if\s*\(([^)]*)\)\s*\{([\s\S]*?)\}(?:\s*else\s*\{([\s\S]*)\})?$/i.exec(raw);
    if (ifMatch) {
        const elseLabel = nextLabel(ctx, "else");
        const endLabel = nextLabel(ctx, "endif");
        emitConditionJumpFalse(ifMatch[1], elseLabel, line, ctx, out);
        emitStatements(splitStatements(ifMatch[2]), lineOffset + statement.line, ctx, out);
        emitLongJump(endLabel, out);
        out.push(`${elseLabel}:`);
        if (ifMatch[3])
            emitStatements(splitStatements(ifMatch[3]), lineOffset + statement.line, ctx, out);
        out.push(`${endLabel}:`);
        return;
    }
    const whileEmpty = /^while\s*\(([^)]*)\)\s*;$/i.exec(raw);
    if (whileEmpty) {
        const start = nextLabel(ctx, "whilewait");
        const end = nextLabel(ctx, "whilewaitend");
        out.push(`${start}:`);
        emitConditionJumpFalse(whileEmpty[1], end, line, ctx, out);
        emitLongJump(start, out);
        out.push(`${end}:`);
        return;
    }
    const ifSingle = /^if\s*\(([^)]*)\)\s*([\s\S]+?;?)(?:\s*else\s*([\s\S]+?;?))?$/i.exec(raw);
    if (ifSingle && !ifSingle[2].trim().startsWith("{")) {
        const elseLabel = nextLabel(ctx, "else");
        const endLabel = nextLabel(ctx, "endif");
        emitConditionJumpFalse(ifSingle[1], elseLabel, line, ctx, out);
        emitStatement({ text: ensureSemi(ifSingle[2].trim()), line: statement.line }, lineOffset, ctx, out);
        emitLongJump(endLabel, out);
        out.push(`${elseLabel}:`);
        if (ifSingle[3]) emitStatement({ text: ensureSemi(ifSingle[3].trim()), line: statement.line }, lineOffset, ctx, out);
        out.push(`${endLabel}:`);
        return;
    }
    const returnMatch = /^return(?:\s+(.+?))?\s*;?$/i.exec(raw);
    if (returnMatch) {
        if (returnMatch[1]) emitLoadA(returnMatch[1], line, ctx, out);
        out.push("ret");
        return;
    }
    const declaration = /^(?:volatile\s+)?(?:(?:unsigned|signed)\s+)?(?:char|int|long|bit|uint8_t)(?:\s+(?:data|idata|xdata|bdata|pdata|far))?\s+(.+);?$/i.exec(raw);
    if (declaration) {
        for (const part of splitCommaSafe(declaration[1])) {
            const m = /^([A-Za-z_]\w*)(?:\s*=\s*(.+))?$/.exec(part.trim());
            if (!m)
                continue;
            const declType = raw.toLowerCase();
            const variable = allocVar(m[1], ctx, /\b(?:int|long)\b/.test(declType) ? 2 : 1);
            if (m[2] != null) {
                if (variable.size === 2)
                    emitAssignToVar16(variable, m[2], line, ctx, out);
                else
                    emitAssignToAddr(variable.addr, m[2], line, ctx, out);
            }
        }
        return;
    }
    const call = /^([A-Za-z_]\w*)\s*\((.*)\)\s*;?$/i.exec(raw);
    if (call) {
        emitCall(call[1], call[2], line, ctx, out);
        return;
    }
    const inc = /^([A-Za-z_]\w*)\s*(\+\+|--)\s*;?$/i.exec(raw);
    if (inc) {
        const target = resolveTarget(inc[1], ctx);
        if (target)
            out.push(`${inc[2] === "++" ? "inc" : "dec"} ${target}`);
        else
            ctx.diagnostics.push({ level: "warning", line, message: `C increment target unknown: ${raw}` });
        return;
    }
    const compound = /^([A-Za-z_]\w*)\s*([+\-&|^])=\s*(.+)\s*;?$/i.exec(raw);
    if (compound) {
        emitCompoundAssign(compound[1], compound[2], compound[3], line, ctx, out);
        return;
    }
    const assign = /^([A-Za-z_]\w*)\s*=\s*(.+)\s*;?$/i.exec(raw);
    if (assign) {
        emitAssignment(assign[1], assign[2], line, ctx, out);
        return;
    }
    ctx.diagnostics.push({ level: "warning", line, message: `C line not translated: ${raw}` });
}
function emitCall(nameRaw, argsRaw, line, ctx, out) {
    const name = nameRaw.toLowerCase();
    const args = splitCommaSafe(argsRaw);
    // Methodychka lab-level builtins. User-defined versions still work for names that are not handled here.
    // These are intentionally close to the examples in the PDF: write/register latches, LED, Static, keypad, ADC and stepper.
    if (name === "clearlatches" || name === "clear_latches") {
        for (let a = 1; a <= 8; a++) emitBusWrite([hexByte(a), "0xff"], line, ctx, out);
        return;
    }
    if (name === "clearstatic" || name === "clear_static") {
        for (let a = 1; a <= 4; a++) emitBusWrite([hexByte(a), "0xff"], line, ctx, out);
        return;
    }
    if (name === "static") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("mov r4,a");
        const v16 = parseWideValue(args[0] ?? "0", ctx);
        if (v16 != null) {
            emitBusWrite(["0x01", hexByte(DIGIT_TO_SEG[v16 & 0x0f])], line, ctx, out);
            emitBusWrite(["0x02", hexByte(DIGIT_TO_SEG[(v16 >> 4) & 0x0f])], line, ctx, out);
            emitBusWrite(["0x03", hexByte(DIGIT_TO_SEG[(v16 >> 8) & 0x0f])], line, ctx, out);
            emitBusWrite(["0x04", hexByte(DIGIT_TO_SEG[(v16 >> 12) & 0x0f])], line, ctx, out);
        } else {
            emitLoadA(args[0] ?? "0", line, ctx, out);
            out.push("mov r6,a");
            out.push("call static_display_low_byte");
            ctx.needStaticDisplay = true;
        }
        return;
    }
    if (name === "staticl") {
        const v = parseValue(args[0] ?? "0", ctx);
        if (v != null) {
            emitBusWrite(["0x01", hexByte(DIGIT_TO_SEG[v & 0x0f])], line, ctx, out);
            emitBusWrite(["0x02", hexByte(DIGIT_TO_SEG[(v >> 4) & 0x0f])], line, ctx, out);
        } else {
            emitLoadA(args[0] ?? "0", line, ctx, out);
            out.push("mov r6,a");
            out.push("call static_display_l");
            ctx.needStaticDisplay = true;
        }
        return;
    }
    if (name === "statich") {
        const v = parseValue(args[0] ?? "0", ctx);
        if (v != null) {
            emitBusWrite(["0x03", hexByte(DIGIT_TO_SEG[v & 0x0f])], line, ctx, out);
            emitBusWrite(["0x04", hexByte(DIGIT_TO_SEG[(v >> 4) & 0x0f])], line, ctx, out);
        } else {
            emitLoadA(args[0] ?? "0", line, ctx, out);
            out.push("mov r6,a");
            out.push("call static_display_h");
            ctx.needStaticDisplay = true;
        }
        return;
    }
    if (name === "step" || name === "stepper") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("call stepper_halfstep");
        ctx.needStepper = true;
        return;
    }
    if (name === "stepv") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("call stepper_v");
        ctx.needStepper = true;
        return;
    }
    if (name === "delay" || name === "sleep") {
        ctx.needDelay = true;
        out.push("call delay");
        return;
    }
    if (name === "delay_ms") {
        const n = parseValue(args[0] ?? "1", ctx) ?? 1;
        ctx.needDelay = true;
        for (let i = 0; i < Math.max(1, Math.min(n, 20)); i++)
            out.push("call delay");
        return;
    }
    if (name === "_nop_" || name === "nop") {
        out.push("nop");
        return;
    }
    if (name === "write" || name === "st_write" || name === "bus_write") {
        emitBusWrite(args, line, ctx, out);
        return;
    }
    if (name === "led" || name === "leds" || name === "led_line" || name === "led_bar") {
        emitBusWrite(["0x07", args[0] ?? "0xff"], line, ctx, out);
        return;
    }
    if (name === "led_off" || name === "leds_off") {
        emitBusWrite(["0x07", "0xff"], line, ctx, out);
        return;
    }
    if (name === "led_all" || name === "leds_all") {
        emitBusWrite(["0x07", "0x00"], line, ctx, out);
        return;
    }
    if (name === "led_on") {
        emitLoadA(args[0] ?? "1", line, ctx, out);
        out.push("call led_on");
        ctx.needLedOn = true;
        return;
    }
    if (name === "seg" || name === "sevenseg" || name === "seven_seg") {
        emitSevenSegRaw(args, line, ctx, out);
        return;
    }
    if (name === "seg_digit" || name === "sevenseg_digit" || name === "digit") {
        emitSevenSegDigit(args, line, ctx, out);
        return;
    }
    if (name === "seg_clear" || name === "sevenseg_clear") {
        for (let a = 1; a <= 4; a++)
            emitBusWrite([hexByte(a), "0xff"], line, ctx, out);
        return;
    }
    if (name === "matrix" || name === "matrix_write") {
        emitBusWrite(["0x05", args[0] ?? "0"], line, ctx, out);
        emitBusWrite(["0x06", args[1] ?? "0"], line, ctx, out);
        return;
    }
    if (name === "matrix_rows") {
        emitBusWrite(["0x05", args[0] ?? "0"], line, ctx, out);
        return;
    }
    if (name === "matrix_cols") {
        emitBusWrite(["0x06", args[0] ?? "0"], line, ctx, out);
        return;
    }
    if (name === "lcd_cmd" || name === "lcd_command") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("mov r5,#0x00");
        out.push("call lcd_write_byte");
        ctx.needLcd = true;
        return;
    }
    if (name === "lcd_data" || name === "lcd_char" || name === "lcd_putc") {
        emitLoadA(args[0] ?? "' '", line, ctx, out);
        out.push("mov r5,#0x01");
        out.push("call lcd_write_byte");
        ctx.needLcd = true;
        return;
    }
    if (name === "lcd_clear") {
        emitLiteralLcdCommand(0x01, ctx, out);
        return;
    }
    if (name === "lcd_home") {
        emitLiteralLcdCommand(0x02, ctx, out);
        return;
    }
    if (name === "lcd_init") {
        for (const cmd of [0x28, 0x0c, 0x06, 0x01])
            emitLiteralLcdCommand(cmd, ctx, out);
        return;
    }
    if (name === "lcd_line") {
        const lineNo = parseValue(args[0] ?? "1", ctx) ?? 1;
        const addr = [0x80, 0xc0, 0x94, 0xd4][Math.max(0, Math.min(3, lineNo - 1))];
        emitLiteralLcdCommand(addr, ctx, out);
        return;
    }
    if (name === "lcd_puts" || name === "lcd_print") {
        const text = parseStringLiteral(args[0] ?? "");
        if (text == null) {
            ctx.diagnostics.push({ level: "warning", line, message: `${nameRaw}(...) підтримує поки тільки рядок у лапках.` });
            return;
        }
        for (const ch of text.slice(0, 64))
            emitLiteralLcdData(ch.charCodeAt(0), ctx, out);
        return;
    }
    if (BUILTIN_RETURN_CALLS.has(name)) {
        emitReturnCallToA(name, args, line, ctx, out);
        return;
    }
    if (ctx.functions.has(name)) {
        emitUserFunctionCall(name, args, line, ctx, out);
        return;
    }
    ctx.diagnostics.push({ level: "warning", line, message: `C function not known: ${nameRaw}()` });
}
function emitUserFunctionCall(name, args, line, ctx, out) {
    const fn = ctx.functions.get(name);
    if (!fn) {
        out.push(`call ${sanitizeLabel(name)}`);
        return;
    }
    const params = fn.params ?? [];
    for (let i = 0; i < params.length; i++) {
        const param = params[i];
        const info = allocVar(param.name, ctx, param.size);
        const arg = args[i] ?? "0";
        if (param.size === 2) {
            emitAssignToVar16(info, arg, line, ctx, out);
        }
        else {
            emitLoadA(arg, line, ctx, out);
            out.push(`mov ${hexByte(info.addr)},a`);
        }
    }
    out.push(`call ${sanitizeLabel(name)}`);
}
function emitAssignToVar16(info, expr, line, ctx, out) {
    const value = parseWideValue(expr, ctx);
    if (value != null) {
        out.push(`mov ${hexByte(info.addr)},#${hexByte(value & 0xff)}`);
        out.push(`mov ${hexByte(info.addr + 1)},#${hexByte((value >> 8) & 0xff)}`);
        return;
    }
    const src = ctx.vars.get(expr.trim().toLowerCase());
    if (src && src.size === 2) {
        out.push(`mov a,${hexByte(src.addr)}`);
        out.push(`mov ${hexByte(info.addr)},a`);
        out.push(`mov a,${hexByte(src.addr + 1)}`);
        out.push(`mov ${hexByte(info.addr + 1)},a`);
        return;
    }
    emitLoadA(expr, line, ctx, out);
    out.push(`mov ${hexByte(info.addr)},a`);
    out.push(`mov ${hexByte(info.addr + 1)},#0x00`);
}
function parseWideValue(raw, ctx) {
    const text = raw.trim().replace(/;$/, "");
    const constVal = ctx.constants?.get(text.toLowerCase());
    if (constVal)
        return parseWideValue(constVal, ctx);
    const num = normalizeNumber(text);
    if (!num)
        return null;
    if (/^0x/i.test(num))
        return Number.parseInt(num.slice(2), 16) & 0xffff;
    if (/^[01]+b$/i.test(num))
        return Number.parseInt(num.slice(0, -1), 2) & 0xffff;
    if (/^0b/i.test(num))
        return Number.parseInt(num.slice(2), 2) & 0xffff;
    return Number.parseInt(num, 10) & 0xffff;
}
function emitBusWrite(args, line, ctx, out) {
    if (args.length < 2) {
        ctx.diagnostics.push({ level: "error", line, message: "write(addr,data) потребує 2 аргументи." });
        return;
    }
    emitLoadA(args[1], line, ctx, out);
    out.push("mov r7,a");
    emitLoadA(args[0], line, ctx, out);
    out.push("mov r6,a");
    out.push("call write");
    ctx.needWrite = true;
}
function emitSevenSegRaw(args, line, ctx, out) {
    const pos = parseValue(args[0] ?? "1", ctx);
    if (pos == null || pos < 1 || pos > 4) {
        ctx.diagnostics.push({ level: "warning", line, message: "sevenseg(pos,value): pos має бути 1..4." });
        return;
    }
    // User-facing logical order: pos 1 is the leftmost digit, pos 4 is the rightmost.
    // Hardware/ST841 bus order remains unchanged: addr 1 is rightmost, addr 4 is leftmost.
    emitBusWrite([hexByte(5 - pos), args[1] ?? "0xff"], line, ctx, out);
}
function emitSevenSegDigit(args, line, ctx, out) {
    const pos = parseValue(args[0] ?? "1", ctx);
    if (pos == null || pos < 1 || pos > 4) {
        ctx.diagnostics.push({ level: "warning", line, message: "seg_digit(pos,digit): pos має бути 1..4." });
        return;
    }
    emitLoadA(args[1] ?? "0", line, ctx, out);
    out.push("call seg_digit_to_pattern");
    out.push("mov r7,a");
    // User-facing logical order: pos 1 is leftmost, pos 4 is rightmost.
    // Raw methodical writes P2=1..4 are not changed.
    out.push(`mov r6,#${hexByte(5 - pos)}`);
    out.push("call write");
    ctx.needSegDigit = true;
}
function emitReturnCallToA(name, args, line, ctx, out) {
    if (name === "read_adc" || name === "adc_read" || name === "adc_high" || name === "read_adc_high" || name === "getadc" || name === "get_adc" || name === "adc" || name === "readadc") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("call read_adc");
        ctx.needReadAdc = true;
        return;
    }
    if (name === "adc_low" || name === "read_adc_low") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("call read_adc_low");
        ctx.needReadAdcLow = true;
        return;
    }
    if (name === "joystick_x" || name === "joy_x") {
        out.push("mov a,#0x06");
        out.push("call read_adc");
        ctx.needReadAdc = true;
        return;
    }
    if (name === "joystick_y" || name === "joy_y") {
        out.push("mov a,#0x07");
        out.push("call read_adc");
        ctx.needReadAdc = true;
        return;
    }
    if (name === "keypad_read" || name === "key_read" || name === "readkey" || name === "read_key") {
        emitLoadA(args[0] ?? "0x60", line, ctx, out);
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
    if (name === "keypad_col1") {
        out.push("mov a,#0x60");
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
    if (name === "keypad_col2") {
        out.push("mov a,#0x50");
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
    if (name === "keypad_col3") {
        out.push("mov a,#0x30");
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
}
function emitAssignment(leftRaw, rightRaw, line, ctx, out) {
    const left = leftRaw.trim();
    const leftLower = left.toLowerCase();
    const bit = ctx.sbit.get(leftLower);
    if (bit) {
        const v = parseValue(rightRaw, ctx);
        if (v === 0 || v === 1)
            out.push(v ? `setb ${bit}` : `clr ${bit}`);
        else
            ctx.diagnostics.push({ level: "warning", line, message: `sbit ${left}=... підтримує тільки 0 або 1.` });
        return;
    }
    const rhsClean = rightRaw.trim().replace(/;$/, "");
    const fnCall = /^([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(rhsClean);
    if (fnCall && BUILTIN_RETURN_CALLS.has(fnCall[1].toLowerCase())) {
        emitReturnCallToA(fnCall[1].toLowerCase(), splitCommaSafe(fnCall[2]), line, ctx, out);
        const target = resolveTarget(left, ctx) ?? hexByte(allocVar(left, ctx).addr);
        out.push(`mov ${target},a`);
        return;
    }
    if (fnCall && ctx.functions.has(fnCall[1].toLowerCase())) {
        emitUserFunctionCall(fnCall[1].toLowerCase(), splitCommaSafe(fnCall[2]), line, ctx, out);
        const target = resolveTarget(left, ctx) ?? hexByte(allocVar(left, ctx).addr);
        out.push(`mov ${target},a`);
        return;
    }
    const arrayTarget = /^([A-Za-z_]\w*)\s*\[([\s\S]+)\]$/.exec(left);
    if (arrayTarget) {
        const info = ctx.vars.get(arrayTarget[1].toLowerCase());
        const idx = parseValue(arrayTarget[2], ctx);
        if (info && idx != null) {
            emitLoadA(rightRaw, line, ctx, out);
            out.push(`mov ${hexByte(info.addr + idx)},a`);
            return;
        }
        ctx.diagnostics.push({ level: "warning", line, message: `array assignment supports constant index only: ${left}` });
        return;
    }
    const target = resolveTarget(left, ctx) ?? hexByte(allocVar(left, ctx).addr);
    emitLoadA(rightRaw, line, ctx, out);
    out.push(`mov ${target},a`);
}
function emitAssignToAddr(addr, expr, line, ctx, out) {
    emitLoadA(expr, line, ctx, out);
    out.push(`mov ${hexByte(addr)},a`);
}
function emitCompoundAssign(left, op, right, line, ctx, out) {
    const target = resolveTarget(left, ctx) ?? hexByte(allocVar(left, ctx).addr);
    out.push(`mov a,${target}`);
    const imm = parseValue(right, ctx);
    const rightTarget = resolveTarget(right, ctx);
    let operand = imm != null ? `#${hexByte(imm)}` : rightTarget;
    if (!operand) {
        emitLoadA(right, line, ctx, out);
        out.push("mov r0,a");
        out.push(`mov a,${target}`);
        operand = "r0";
    }
    if (op === "+")
        out.push(`add a,${operand}`);
    else if (op === "-") {
        out.push("clr c");
        out.push(`subb a,${operand}`);
    }
    else if (op === "&")
        out.push(`anl a,${operand}`);
    else if (op === "|")
        out.push(`orl a,${operand}`);
    else if (op === "^")
        out.push(`xrl a,${operand}`);
    out.push(`mov ${target},a`);
}
function emitLoadArrayLookup(arrayName, indexExpr, line, ctx, out) {
    emitLoadIndexA(indexExpr, line, ctx, out);
    const values = ctx.arrays.get(arrayName) ?? [];
    const routine = `lookup_${sanitizeLabel(arrayName)}`;
    out.push(`call ${routine}`);
    ctx[`need_array_${arrayName}`] = true;
    ctx.arrayRoutines = ctx.arrayRoutines ?? new Map();
    ctx.arrayRoutines.set(routine, values);
}
function emitLoadIndexA(exprRaw, line, ctx, out) {
    const expr = exprRaw.trim().replace(/\s+/g, "");
    const nib = /^\(?([A-Za-z_]\w*)>>(\d+)\)?&(?:0x0[fF]|15)$/.exec(expr);
    if (nib) {
        const v = ctx.vars.get(nib[1].toLowerCase());
        const shift = Number(nib[2]);
        if (v && v.size === 2) {
            if (shift < 8)
                out.push(`mov a,${hexByte(v.addr)}`);
            else
                out.push(`mov a,${hexByte(v.addr + 1)}`);
            if (shift % 8 === 4)
                out.push("swap a");
            out.push("anl a,#0x0f");
            return;
        }
    }
    const lowNib = /^\(?([A-Za-z_]\w*)\)?&(?:0x0[fF]|15)$/.exec(expr);
    if (lowNib) {
        const v = ctx.vars.get(lowNib[1].toLowerCase());
        if (v) {
            out.push(`mov a,${hexByte(v.addr)}`);
            out.push("anl a,#0x0f");
            return;
        }
        const target = resolveTarget(lowNib[1], ctx);
        if (target) {
            out.push(`mov a,${target}`);
            out.push("anl a,#0x0f");
            return;
        }
    }
    const simpleShift = /^\(?([A-Za-z_]\w*)>>(\d+)\)?$/.exec(expr);
    if (simpleShift) {
        const v = ctx.vars.get(simpleShift[1].toLowerCase());
        const shift = Number(simpleShift[2]);
        if (v && v.size === 2) {
            if (shift < 8)
                out.push(`mov a,${hexByte(v.addr)}`);
            else
                out.push(`mov a,${hexByte(v.addr + 1)}`);
            if (shift % 8 === 4)
                out.push("swap a");
            return;
        }
    }
    const value = parseValue(exprRaw, ctx);
    if (value != null) {
        out.push(`mov a,#${hexByte(value)}`);
        return;
    }
    emitLoadA(exprRaw, line, ctx, out);
}
function emitLoadA(exprRaw, line, ctx, out) {
    const expr = stripOuterParens(exprRaw.trim().replace(/;$/, ""));
    const sizeofMatch = /^sizeof\s*\(\s*([^)]*)\s*\)$/i.exec(expr);
    if (sizeofMatch) {
        const what = sizeofMatch[1].trim().toLowerCase();
        let size = 1;
        if (/\b(int|long)\b/.test(what)) size = 2;
        const v = ctx.vars?.get(what);
        if (v) size = v.size ?? 1;
        out.push(`mov a,#${hexByte(size)}`);
        return;
    }
    const ternary = splitTopLevelTernary(expr);
    if (ternary) {
        const falseLabel = nextLabel(ctx, "ternfalse");
        const endLabel = nextLabel(ctx, "ternend");
        emitConditionJumpFalse(ternary.cond, falseLabel, line, ctx, out);
        emitLoadA(ternary.whenTrue, line, ctx, out);
        emitLongJump(endLabel, out);
        out.push(`${falseLabel}:`);
        emitLoadA(ternary.whenFalse, line, ctx, out);
        out.push(`${endLabel}:`);
        return;
    }
    const prefixInc = /^(\+\+|--)([A-Za-z_]\w*)$/i.exec(expr);
    if (prefixInc) {
        const target = resolveTarget(prefixInc[2], ctx);
        if (target) {
            out.push(`${prefixInc[1] === "++" ? "inc" : "dec"} ${target}`);
            out.push(`mov a,${target}`);
            return;
        }
    }
    const postfixInc = /^([A-Za-z_]\w*)(\+\+|--)$/i.exec(expr);
    if (postfixInc) {
        const target = resolveTarget(postfixInc[1], ctx);
        if (target) {
            out.push(`mov a,${target}`);
            out.push(`${postfixInc[2] === "++" ? "inc" : "dec"} ${target}`);
            return;
        }
    }
    const arrayLookup = /^([A-Za-z_]\w*)\s*\[([\s\S]+)\]$/.exec(expr);
    if (arrayLookup && ctx.arrays?.has(arrayLookup[1].toLowerCase())) {
        emitLoadArrayLookup(arrayLookup[1].toLowerCase(), arrayLookup[2], line, ctx, out);
        return;
    }
    const constVal = parseValue(expr, ctx);
    if (constVal != null) {
        out.push(`mov a,#${hexByte(constVal)}`);
        return;
    }
    const unaryNot = /^~\s*(.+)$/i.exec(expr);
    if (unaryNot) {
        emitLoadA(unaryNot[1], line, ctx, out);
        out.push("cpl a");
        return;
    }
    const fnCall = /^([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(expr);
    if (fnCall && BUILTIN_RETURN_CALLS.has(fnCall[1].toLowerCase())) {
        emitReturnCallToA(fnCall[1].toLowerCase(), splitCommaSafe(fnCall[2]), line, ctx, out);
        return;
    }
    if (fnCall && ctx.functions.has(fnCall[1].toLowerCase())) {
        emitUserFunctionCall(fnCall[1].toLowerCase(), splitCommaSafe(fnCall[2]), line, ctx, out);
        return;
    }
    const binary = splitTopLevelBinary(expr);
    if (binary) {
        emitLoadA(binary.left, line, ctx, out);
        const imm = parseValue(binary.right, ctx);
        const target = resolveTarget(binary.right, ctx);
        const operand = imm != null ? `#${hexByte(imm)}` : target;
        if (!operand) {
            ctx.diagnostics.push({ level: "warning", line, message: `C expression RHS unsupported: ${expr}` });
            return;
        }
        if (binary.op === "+")
            out.push(`add a,${operand}`);
        else if (binary.op === "-") {
            out.push("clr c");
            out.push(`subb a,${operand}`);
        }
        else if (binary.op === "&")
            out.push(`anl a,${operand}`);
        else if (binary.op === "|")
            out.push(`orl a,${operand}`);
        else if (binary.op === "^")
            out.push(`xrl a,${operand}`);
        else if (binary.op === "<<" || binary.op === ">>") {
            const count = parseValue(binary.right, ctx);
            if (count != null) {
                emitLoadA(binary.left, line, ctx, out);
                emitShiftLoadedA(binary.op, count & 0x1f, out);
            }
            else {
                emitLoadA(binary.left, line, ctx, out);
                out.push("mov r0,a");
                emitLoadA(binary.right, line, ctx, out);
                out.push("mov r1,a");
                out.push("mov a,r0");
                emitVariableShiftLoadedA(binary.op, out, ctx);
            }
        }
        return;
    }
    const target = resolveTarget(expr, ctx);
    if (target) {
        out.push(`mov a,${target}`);
        return;
    }
    ctx.diagnostics.push({ level: "warning", line, message: `C expression not translated, using 0: ${expr}` });
    out.push("mov a,#0");
}

function emitShiftLoadedA(op, count, out) {
    const n = Math.max(0, Math.min(31, Number(count) || 0));
    for (let i = 0; i < n; i++) {
        if (op === "<<") {
            out.push("add a,a");
        }
        else {
            out.push("clr c");
            out.push("rrc a");
        }
    }
}
function emitVariableShiftLoadedA(op, out, ctx) {
    const loop = nextLabel(ctx, op === "<<" ? "shl" : "shr");
    const end = nextLabel(ctx, op === "<<" ? "shlend" : "shrend");
    out.push(`${loop}:`);
    out.push("mov r2,a");
    out.push("mov a,r1");
    out.push(`jz ${end}`);
    out.push("dec r1");
    out.push("mov a,r2");
    if (op === "<<") {
        out.push("add a,a");
    }
    else {
        out.push("clr c");
        out.push("rrc a");
    }
    out.push(`sjmp ${loop}`);
    out.push(`${end}:`);
    out.push("mov a,r2");
}

function emitConditionJumpFalse(condRaw, falseLabel, line, ctx, out) {
    const cond = stripOuterParens(condRaw.trim());
    const orParts = splitTopLevelLogical(cond, "||");
    if (orParts.length > 1) {
        const pass = nextLabel(ctx, "orpass");
        for (const part of orParts) {
            const nextFalse = nextLabel(ctx, "ornext");
            emitConditionJumpFalse(part, nextFalse, line, ctx, out);
            emitLongJump(pass, out);
            out.push(`${nextFalse}:`);
        }
        emitLongJump(falseLabel, out);
        out.push(`${pass}:`);
        return;
    }
    const andParts = splitTopLevelLogical(cond, "&&");
    if (andParts.length > 1) {
        for (const part of andParts) emitConditionJumpFalse(part, falseLabel, line, ctx, out);
        return;
    }
    const bit = ctx.sbit.get(cond.toLowerCase());
    if (bit) {
        const pass = nextLabel(ctx, "bitpass");
        out.push(`jb ${bit},${pass}`);
        emitLongJump(falseLabel, out);
        out.push(`${pass}:`);
        return;
    }
    const notBit = /^!\s*([A-Za-z_]\w*)$/.exec(cond);
    if (notBit) {
        const b = ctx.sbit.get(notBit[1].toLowerCase());
        if (b) {
            const pass = nextLabel(ctx, "bitpass");
            out.push(`jnb ${b},${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
            return;
        }
    }
    const cmp = /^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(cond);
    if (cmp) {
        emitLoadA(cmp[1], line, ctx, out);
        const imm = parseValue(cmp[3], ctx);
        const target = resolveTarget(cmp[3], ctx);
        const operand = imm != null ? `#${hexByte(imm)}` : target;
        if (!operand) {
            ctx.diagnostics.push({ level: "warning", line, message: `C compare RHS unsupported: ${cond}` });
            emitLongJump(falseLabel, out);
            return;
        }
        const op = cmp[2];
        if (op === "==") {
            const neq = nextLabel(ctx, "cmpneq");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${neq}`);
            emitLongJump(pass, out);
            out.push(`${neq}:`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === "!=") {
            const pass = nextLabel(ctx, "cmpnepass");
            out.push(`cjne a,${operand},${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === "<") {
            const cmpLabel = nextLabel(ctx, "cmplt");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(falseLabel, out);
            out.push(`${cmpLabel}:`);
            out.push(`jc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === ">=") {
            const cmpLabel = nextLabel(ctx, "cmpge");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(pass, out);
            out.push(`${cmpLabel}:`);
            out.push(`jnc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === ">") {
            const cmpLabel = nextLabel(ctx, "cmpgt");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(falseLabel, out);
            out.push(`${cmpLabel}:`);
            out.push(`jnc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === "<=") {
            const cmpLabel = nextLabel(ctx, "cmple");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(pass, out);
            out.push(`${cmpLabel}:`);
            out.push(`jc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        return;
    }
    emitLoadA(cond, line, ctx, out);
    const pass = nextLabel(ctx, "nzpass");
    out.push(`jnz ${pass}`);
    emitLongJump(falseLabel, out);
    out.push(`${pass}:`);
}

function emitSwitch(expr, body, line, lineOffset, ctx, out) {
    const end = nextLabel(ctx, "switchend");
    const defaultLabel = nextLabel(ctx, "switchdefault");
    const cases = [];
    const re = /\bcase\s+([^:]+):|\bdefault\s*:/gi;
    let m;
    let last = null;
    while ((m = re.exec(body))) {
        if (last) {
            last.body = body.slice(last.start, m.index);
            cases.push(last);
        }
        if (m[0].toLowerCase().startsWith("case")) {
            last = { value: m[1].trim(), label: nextLabel(ctx, "case"), start: re.lastIndex, body: "" };
        } else {
            last = { value: null, label: defaultLabel, start: re.lastIndex, body: "" };
        }
    }
    if (last) {
        last.body = body.slice(last.start);
        cases.push(last);
    }
    emitLoadA(expr, line, ctx, out);
    out.push("mov r0,a");
    for (const item of cases) {
        if (item.value == null) continue;
        const v = parseValue(item.value, ctx);
        if (v == null) continue;
        out.push("mov a,r0");
        out.push(`cjne a,#${hexByte(v)},${item.label}_skip`);
        emitLongJump(item.label, out);
        out.push(`${item.label}_skip:`);
    }
    emitLongJump(cases.some((item) => item.value == null) ? defaultLabel : end, out);
    ctx.breakStack.push(end);
    for (const item of cases) {
        out.push(`${item.label}:`);
        emitStatements(splitStatements(item.body), lineOffset, ctx, out);
    }
    ctx.breakStack.pop();
    out.push(`${end}:`);
}

function emitLongJump(label, out) {
    out.push(`ljmp ${label}`);
}
function resolveTarget(nameRaw, ctx) {
    const name = nameRaw.trim().toLowerCase();
    if (REGISTER_NAMES.has(name))
        return name === "acc" ? "a" : name;
    const sfr = ctx.sfr.get(name);
    if (sfr)
        return sfr;
    const variable = ctx.vars.get(name);
    if (variable)
        return hexByte(variable.addr);
    const num = parseValue(nameRaw, ctx);
    if (num != null && num >= 0x80 && num <= 0xff)
        return hexByte(num);
    return null;
}
function allocVar(nameRaw, ctx, size = 1) {
    const name = nameRaw.toLowerCase();
    const existing = ctx.vars.get(name);
    if (existing)
        return existing;
    let addr = 0x20;
    for (const item of ctx.vars.values())
        addr += item.size ?? 1;
    const info = { name, addr, size };
    ctx.vars.set(name, info);
    return info;
}
function emitWriteRoutine(out) {
    out.push("write:");
    out.push("setb p3.6");
    out.push("mov p0,r7");
    out.push("mov p2,r6");
    out.push("nop");
    out.push("mov p2,#0x00");
    out.push("ret");
    out.push("");
}
function emitReadAdcRoutine(out) {
    out.push("read_adc:");
    out.push("mov 0xd8,a");
    out.push("clr 0xdf");
    out.push("setb 0xdc");
    out.push("jnb 0xdf,$");
    out.push("mov a,0xda");
    out.push("anl a,#00001111b");
    out.push("ret");
    out.push("");
}
function emitReadAdcLowRoutine(out) {
    out.push("read_adc_low:");
    out.push("mov 0xd8,a");
    out.push("clr 0xdf");
    out.push("setb 0xdc");
    out.push("jnb 0xdf,$");
    out.push("mov a,0xd9");
    out.push("ret");
    out.push("");
}
function emitKeypadReadRoutine(out) {
    out.push("keypad_read:");
    out.push("clr p3.6");
    out.push("mov p2,a");
    out.push("nop");
    out.push("mov a,p0");
    out.push("anl a,#0x0f");
    out.push("ret");
    out.push("");
}
function emitLcdRoutine(out) {
    out.push("lcd_write_byte:");
    out.push("mov b,a");
    out.push("anl a,#0xf0");
    out.push("orl a,r5");
    out.push("mov r7,a");
    out.push("mov r6,#0x08");
    out.push("call write");
    out.push("mov a,b");
    out.push("swap a");
    out.push("anl a,#0xf0");
    out.push("orl a,r5");
    out.push("mov r7,a");
    out.push("mov r6,#0x08");
    out.push("call write");
    out.push("ret");
    out.push("");
}
function emitLedOnRoutine(out) {
    out.push("led_on:");
    out.push("dec a");
    out.push("anl a,#0x07");
    out.push("mov r4,a");
    out.push("mov a,#0x01");
    out.push("led_on_shift:");
    out.push("cjne r4,#0x00,led_on_do_shift");
    out.push("sjmp led_on_ready");
    out.push("led_on_do_shift:");
    out.push("rl a");
    out.push("dec r4");
    out.push("sjmp led_on_shift");
    out.push("led_on_ready:");
    out.push("cpl a");
    out.push("mov r7,a");
    out.push("mov r6,#0x07");
    out.push("call write");
    out.push("ret");
    out.push("");
}
function emitSegDigitRoutine(out) {
    out.push("seg_digit_to_pattern:");
    for (let i = 0; i < DIGIT_TO_SEG.length; i++) {
        const next = `seg_digit_${i + 1}`;
        out.push(`cjne a,#${hexByte(i)},${next}`);
        out.push(`mov a,#${hexByte(DIGIT_TO_SEG[i])}`);
        out.push("ret");
        out.push(`${next}:`);
    }
    out.push("mov a,#0x00");
    out.push("ret");
    out.push("");
}
function emitArrayRoutines(out, routines) {
    for (const [routine, values] of routines.entries()) {
        out.push(`${routine}:`);
        for (let i = 0; i < values.length; i++) {
            const next = `${routine}_${i + 1}`;
            out.push(`cjne a,#${hexByte(i)},${next}`);
            out.push(`mov a,#${hexByte(values[i])}`);
            out.push("ret");
            out.push(`${next}:`);
        }
        out.push("mov a,#0xff");
        out.push("ret");
        out.push("");
    }
}
function emitDelayRoutine(out) {
    out.push("delay:");
    out.push("mov r3,#20");
    out.push("d3:");
    out.push("mov r2,#255");
    out.push("d2:");
    out.push("mov r1,#255");
    out.push("d1:");
    out.push("djnz r1,d1");
    out.push("djnz r2,d2");
    out.push("djnz r3,d3");
    out.push("ret");
    out.push("");
}
function emitLiteralLcdCommand(value, ctx, out) {
    out.push(`mov a,#${hexByte(value)}`);
    out.push("mov r5,#0x00");
    out.push("call lcd_write_byte");
    ctx.needLcd = true;
}
function emitLiteralLcdData(value, ctx, out) {
    out.push(`mov a,#${hexByte(value)}`);
    out.push("mov r5,#0x01");
    out.push("call lcd_write_byte");
    ctx.needLcd = true;
}
function parseFunctions(source) {
    const map = new Map();
    const re = /\b(?:void|int|unsigned\s+char|unsigned\s+int|uint8_t|char|signed\s+char|signed\s+int|signed\s+long|unsigned\s+long|long|bit)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:interrupt\s+\d+)?\s*\{/gi;
    let m;
    while ((m = re.exec(source))) {
        const name = m[1].toLowerCase();
        const params = parseFunctionParams(m[2]);
        const start = re.lastIndex;
        let depth = 1;
        let index = start;
        while (index < source.length && depth > 0) {
            const ch = source[index];
            if (ch === "{")
                depth += 1;
            else if (ch === "}")
                depth -= 1;
            index += 1;
        }
        if (depth === 0) {
            const body = source.slice(start, index - 1);
            const lineOffset = source.slice(0, start).split("\n").length - 1;
            map.set(name, { name, body, lineOffset, params });
            re.lastIndex = index;
        }
    }
    return map;
}
function parseFunctionParams(paramText) {
    const text = paramText.trim();
    if (!text || /^void$/i.test(text))
        return [];
    const params = [];
    const mem = "(?:data|idata|xdata|bdata|pdata|far|code)";
    for (const partRaw of splitCommaSafe(text)) {
        const part = partRaw.trim().replace(/\s+/g, " ");
        // Do NOT blindly remove the word "data": a parameter may be named Data.
        // Accept Keil memory qualifiers only around the type.
        const re = new RegExp(`^(?:${mem}\\s+)?(?:(unsigned|signed)\\s+)?(char|int|long|bit|uint8_t)(?:\\s+${mem})?\\s*(\\*)?\\s+([A-Za-z_]\\w*)$`, "i");
        const m = re.exec(part);
        if (!m)
            continue;
        const base = m[2].toLowerCase();
        const name = m[4].toLowerCase();
        const pointer = !!m[3];
        const size = pointer || base === "int" || base === "long" ? 2 : 1;
        params.push({ name, size });
    }
    return params;
}
function parseCodeArrays(source) {
    const map = new Map();
    const re = /\bconst\s+(?:unsigned\s+char|char|uint8_t)\s+code\s+([A-Za-z_]\w*)\s*\[\s*(?:\d+)?\s*\]\s*=\s*\{([\s\S]*?)\}\s*;/gi;
    let m;
    while ((m = re.exec(source))) {
        const values = [];
        for (const raw of splitCommaSafe(m[2])) {
            const value = parseValue(raw, { constants: new Map(), arrays: new Map(), sfr: new Map(), sbit: new Map(), vars: new Map(), diagnostics: [] });
            if (value != null)
                values.push(value & 0xff);
        }
        map.set(m[1].toLowerCase(), values);
    }
    const strRe = /(?:const\s+)?(?:unsigned\s+char|char|uint8_t)\s+code\s+([A-Za-z_]\w*)\s*\[\s*\]\s*=\s*"([\s\S]*?)"\s*;/gi;
    let sm;
    while ((sm = strRe.exec(source))) {
        const s = sm[2].replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        map.set(sm[1].toLowerCase(), Array.from(s).map((ch) => ch.charCodeAt(0) & 0xff).concat([0]));
    }
    return map;
}

function parseGlobalVars(source, ctx) {
    const scrubbed = source.replace(/\b(?:void|int|unsigned\s+char|unsigned\s+int|uint8_t|char|signed\s+char|signed\s+int|signed\s+long|unsigned\s+long|long|bit)\s+[A-Za-z_]\w*\s*\([^)]*\)\s*(?:interrupt\s+\d+)?\s*\{[\s\S]*?\}/gi, "");
    const re = /^\s*(?!(?:const|sfr|sbit|#))(?:(?:unsigned|signed)\s+)?(char|int|long|bit|uint8_t)(?:\s+(?:data|idata|xdata|bdata|pdata|far))?\s+([^;()]+);/gim;
    let m;
    while ((m = re.exec(scrubbed))) {
        const size = /^(?:int|long)$/i.test(m[1]) ? 2 : 1;
        for (const part of splitCommaSafe(m[2])) {
            const mm = /^([A-Za-z_]\w*)(?:\s*\[\s*(\d+)\s*\])?(?:\s*=\s*(.+))?$/.exec(part.trim());
            if (!mm) continue;
            const count = mm[2] ? Math.max(1, Number(mm[2]) || 1) : 1;
            const info = allocVar(mm[1], ctx, size * count);
            if (mm[3] && !mm[2]) {
                if (size === 2) emitAssignToVar16(info, mm[3], 0, ctx, []);
            }
        }
    }
}

function parseDefines(source) {
    const map = new Map();
    const re = /^\s*#define\s+([A-Za-z_]\w*)\s+([^\s/]+).*$/gim;
    let m;
    while ((m = re.exec(source)))
        map.set(m[1].toLowerCase(), normalizeNumber(m[2]) ?? m[2]);
    return map;
}
function parseSfr(source) {
    const map = new Map();
    const re = /\b(?:sfr|__sfr)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/gi;
    let m;
    while ((m = re.exec(source))) {
        const value = normalizeNumber(m[2]);
        if (value)
            map.set(m[1].toLowerCase(), value);
    }
    const defaults = [
        ["p0", "0x80"], ["sp", "0x81"], ["dpl", "0x82"], ["dph", "0x83"], ["p1", "0x90"], ["p2", "0xa0"], ["p3", "0xb0"],
        ["psw", "0xd0"], ["acc", "0xe0"], ["b", "0xf0"], ["ie", "0xa8"], ["ip", "0xb8"], ["scon", "0x98"], ["sbuf", "0x99"],
        ["adccon1", "0xef"], ["adccon2", "0xd8"], ["adcdatal", "0xd9"], ["adcdatah", "0xda"],
        ["tcon", "0x88"], ["tmod", "0x89"], ["tl0", "0x8a"], ["tl1", "0x8b"], ["th0", "0x8c"], ["th1", "0x8d"],
        ["t2con", "0xc8"], ["t2mod", "0xc9"], ["rcap2l", "0xca"], ["rcap2h", "0xcb"], ["tl2", "0xcc"], ["th2", "0xcd"],
        ["dac0l", "0xf9"], ["dac0h", "0xfa"], ["dac1l", "0xfb"], ["dac1h", "0xfc"], ["daccon", "0xfd"],
        ["pwmcon", "0xd7"], ["pwm0h", "0xfb"], ["pwm0l", "0xfa"], ["pwm1h", "0xfd"], ["pwm1l", "0xfc"],
    ];
    for (const [k, v] of defaults)
        if (!map.has(k.toLowerCase()))
            map.set(k.toLowerCase(), v);
    return map;
}
function parseSbits(source) {
    const map = new Map();
    const portRe = /\b(?:sbit|__sbit)\s+([A-Za-z_]\w*)\s*=\s*P([0-3])\s*\^\s*([0-7])\s*;/gi;
    let m;
    while ((m = portRe.exec(source)))
        map.set(m[1].toLowerCase(), `p${m[2]}.${m[3]}`);
    const bitRe = /\b(?:sbit|__sbit)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/gi;
    while ((m = bitRe.exec(source))) {
        const value = normalizeNumber(m[2]);
        if (value && !map.has(m[1].toLowerCase()))
            map.set(m[1].toLowerCase(), value);
    }
    map.set("wr", "p3.6");
    map.set("rd", "p3.7");
    map.set("int0", "p3.2");
    map.set("int1", "p3.3");
    map.set("t0", "p3.4");
    map.set("t1", "p3.5");
    map.set("adci", "0xdf");
    map.set("sconv", "0xdc");
    return map;
}
function splitStatements(source) {
    const list = [];
    let depth = 0;
    let parenDepth = 0;
    let current = "";
    let line = 1;
    let statementLine = 1;
    let inString = null;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        const prev = source[i - 1];
        current += ch;
        if (ch === "\n")
            line += 1;
        if ((ch === '"' || ch === "'") && prev !== "\\")
            inString = inString === ch ? null : inString ?? ch;
        if (inString)
            continue;
        if (ch === "(")
            parenDepth += 1;
        if (ch === ")")
            parenDepth -= 1;
        if (ch === "{")
            depth += 1;
        if (ch === "}")
            depth -= 1;
        if ((ch === ";" && depth === 0 && parenDepth === 0) || (ch === "}" && depth === 0)) {
            if (ch === "}" && /^\s*else\b/i.test(source.slice(i + 1)))
                continue;
            if (ch === ";" && /^\s*if\b/i.test(current) && /^\s*else\b/i.test(source.slice(i + 1)))
                continue;
            if (ch === "}" && /^\s*while\s*\(/i.test(source.slice(i + 1)) && /^\s*do\b/i.test(current))
                continue;
            const text = current.trim();
            if (text)
                list.push({ text, line: statementLine });
            current = "";
            statementLine = line;
        }
    }
    const tail = current.trim();
    if (tail)
        list.push({ text: tail, line: statementLine });
    return list;
}
function splitCommaSafe(source) {
    const out = [];
    let depth = 0;
    let cur = "";
    let inString = null;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        const prev = source[i - 1];
        if ((ch === '"' || ch === "'") && prev !== "\\")
            inString = inString === ch ? null : inString ?? ch;
        if (!inString) {
            if (ch === "(")
                depth += 1;
            if (ch === ")")
                depth -= 1;
            if (ch === "," && depth === 0) {
                out.push(cur.trim());
                cur = "";
                continue;
            }
        }
        cur += ch;
    }
    if (cur.trim())
        out.push(cur.trim());
    return out;
}
function parseValue(raw, ctx) {
    const text = raw.trim().replace(/^\((.*)\)$/, "$1").replace(/;$/, "");
    const constVal = ctx.constants?.get(text.toLowerCase());
    if (constVal)
        return parseValue(constVal, ctx);
    if (/^~/.test(text)) {
        const inner = parseValue(text.slice(1), ctx);
        if (inner != null) return (~inner) & 0xff;
    }
    const charMatch = /^'(?:\\(.)|([^\\]))'$/.exec(text);
    if (charMatch)
        return (charMatch[1] ?? charMatch[2]).charCodeAt(0) & 0xff;
    const exprValue = parseConstantExpression(text, ctx);
    if (exprValue != null)
        return exprValue & 0xff;
    const num = normalizeNumber(text);
    if (!num)
        return null;
    if (/^0x/i.test(num))
        return Number.parseInt(num.slice(2), 16) & 0xff;
    if (/^[01]+b$/i.test(num))
        return Number.parseInt(num.slice(0, -1), 2) & 0xff;
    if (/^0b/i.test(num))
        return Number.parseInt(num.slice(2), 2) & 0xff;
    return Number.parseInt(num, 10) & 0xff;
}
function parseConstantExpression(text, ctx) {
    if (!/[+\-*/&|^~<>]/.test(text))
        return null;
    let expr = text;
    for (const [name, value] of (ctx.constants ?? new Map())) {
        expr = expr.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), value);
    }
    if (!/^[\dxa-fA-FbBoO\s()+\-*/&|^~<>]+$/.test(expr))
        return null;
    expr = expr.replace(/\b([01]+)b\b/gi, (_m, bits) => `0b${bits}`);
    try {
        // Constant-only evaluator used only after a strict character whitelist above.
        // eslint-disable-next-line no-new-func
        const value = Function(`"use strict"; return (${expr});`)();
        return Number.isFinite(value) ? Number(value) & 0xff : null;
    }
    catch {
        return null;
    }
}
function normalizeNumber(raw) {
    const text = raw.trim().replace(/[uUlL]+$/g, "");
    if (/^0x[0-9a-f]+$/i.test(text))
        return text.toLowerCase();
    if (/^0[0-7]+$/.test(text))
        return `0x${Number.parseInt(text, 8).toString(16)}`;
    if (/^\d+$/.test(text))
        return String(Number.parseInt(text, 10));
    if (/^0b[01]+$/i.test(text))
        return `${text.slice(2)}b`;
    if (/^[01]+b$/i.test(text))
        return text.toLowerCase();
    return null;
}
function parseStringLiteral(raw) {
    const text = raw.trim();
    const match = /^"([\s\S]*)"$/.exec(text);
    if (!match)
        return null;
    return match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}
function ensureSemi(text) {
    const t = text.trim();
    if (!t || t.endsWith(";") || t.endsWith("}")) return t;
    return t + ";";
}
function trimOuter(text) {
    return text.replace(/^\s+|\s+$/g, "");
}
function nextLabel(ctx, prefix) {
    ctx.labels += 1;
    return `c_${prefix}_${ctx.labels}`;
}
function sanitizeLabel(name) {
    return name.toLowerCase().replace(/[^a-z0-9_$?]/g, "_");
}
function hexByte(value) {
    return "0x" + (value & 0xff).toString(16).padStart(2, "0");
}
function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
}

function methodychkaNormalizeSource(source) {
    return source
        .replace(/^\s*#\s*include\s+[<"][^>"]+[>"]\s*$/gim, "")
        .replace(/\b__sfr\b/g, "sfr")
        .replace(/\b__sbit\b/g, "sbit")
        .replace(/\bvoid\s+main\s*\(\s*void\s*\)/gi, "void main()")
        .replace(/\binterrupt\s+\d+\s+using\s+\d+/gi, (m) => m.replace(/using\s+\d+/i, ""));
}

function stripOuterParens(expr) {
    let text = expr.trim();
    let changed = true;
    while (changed && text.startsWith("(") && text.endsWith(")")) {
        changed = false;
        let depth = 0;
        let ok = true;
        let inString = null;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const prev = text[i - 1];
            if ((ch === '"' || ch === "'") && prev !== "\\") inString = inString === ch ? null : inString ?? ch;
            if (inString) continue;
            if (ch === "(") depth++;
            if (ch === ")") depth--;
            if (depth === 0 && i < text.length - 1) { ok = false; break; }
        }
        if (ok) { text = text.slice(1, -1).trim(); changed = true; }
    }
    return text;
}

function splitTopLevelTernary(expr) {
    let depth = 0;
    let q = -1;
    let inString = null;
    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        const prev = expr[i - 1];
        if ((ch === '"' || ch === "'") && prev !== "\\") inString = inString === ch ? null : inString ?? ch;
        if (inString) continue;
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (ch === "?" && depth === 0) { q = i; break; }
    }
    if (q < 0) return null;
    depth = 0;
    inString = null;
    for (let i = q + 1; i < expr.length; i++) {
        const ch = expr[i];
        const prev = expr[i - 1];
        if ((ch === '"' || ch === "'") && prev !== "\\") inString = inString === ch ? null : inString ?? ch;
        if (inString) continue;
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (ch === ":" && depth === 0) {
            return { cond: expr.slice(0, q).trim(), whenTrue: expr.slice(q + 1, i).trim(), whenFalse: expr.slice(i + 1).trim() };
        }
    }
    return null;
}

function splitTopLevelLogical(expr, op) {
    const out = [];
    let depth = 0;
    let start = 0;
    let inString = null;
    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        const prev = expr[i - 1];
        if ((ch === '"' || ch === "'") && prev !== "\\") inString = inString === ch ? null : inString ?? ch;
        if (inString) continue;
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (depth === 0 && expr.slice(i, i + op.length) === op) {
            out.push(expr.slice(start, i).trim());
            start = i + op.length;
            i += op.length - 1;
        }
    }
    if (out.length) out.push(expr.slice(start).trim());
    return out.length ? out : [expr];
}

function splitTopLevelBinary(expr) {
    const ops = ["<<", ">>", "+", "-", "*", "/", "%", "&", "^", "|"];
    let depth = 0;
    let inString = null;
    let best = null;
    for (let i = expr.length - 1; i >= 0; i--) {
        const ch = expr[i];
        const prev = expr[i - 1];
        if ((ch === '"' || ch === "'") && prev !== "\\") inString = inString === ch ? null : inString ?? ch;
        if (inString) continue;
        if (ch === ")") depth++;
        else if (ch === "(") depth--;
        if (depth !== 0) continue;
        for (const op of ops) {
            const start = i - op.length + 1;
            if (start < 0) continue;
            if (expr.slice(start, i + 1) !== op) continue;
            if ((op === "+" || op === "-") && start === 0) continue;
            const left = expr.slice(0, start).trim();
            const right = expr.slice(i + 1).trim();
            if (!left || !right) continue;
            best = { left, op, right };
            break;
        }
        if (best) break;
    }
    return best;
}

function emitMethodReadKeyRoutine(out) {
    out.push("method_readkey:");
    out.push("mov a,#0x60");
    out.push("call keypad_read");
    out.push("cjne a,#0x0e,method_key_c1_r2");
    out.push("mov a,#0x01");
    out.push("ret");
    out.push("method_key_c1_r2:");
    out.push("cjne a,#0x0d,method_key_c1_r3");
    out.push("mov a,#0x04");
    out.push("ret");
    out.push("method_key_c1_r3:");
    out.push("cjne a,#0x0b,method_key_c1_r4");
    out.push("mov a,#0x07");
    out.push("ret");
    out.push("method_key_c1_r4:");
    out.push("cjne a,#0x07,method_key_col2");
    out.push("mov a,#0x0a");
    out.push("ret");
    out.push("method_key_col2:");
    out.push("mov a,#0x50");
    out.push("call keypad_read");
    out.push("cjne a,#0x0e,method_key_c2_r2");
    out.push("mov a,#0x02");
    out.push("ret");
    out.push("method_key_c2_r2:");
    out.push("cjne a,#0x0d,method_key_c2_r3");
    out.push("mov a,#0x05");
    out.push("ret");
    out.push("method_key_c2_r3:");
    out.push("cjne a,#0x0b,method_key_c2_r4");
    out.push("mov a,#0x08");
    out.push("ret");
    out.push("method_key_c2_r4:");
    out.push("cjne a,#0x07,method_key_col3");
    out.push("mov a,#0x00");
    out.push("ret");
    out.push("method_key_col3:");
    out.push("mov a,#0x30");
    out.push("call keypad_read");
    out.push("cjne a,#0x0e,method_key_c3_r2");
    out.push("mov a,#0x03");
    out.push("ret");
    out.push("method_key_c3_r2:");
    out.push("cjne a,#0x0d,method_key_c3_r3");
    out.push("mov a,#0x06");
    out.push("ret");
    out.push("method_key_c3_r3:");
    out.push("cjne a,#0x0b,method_key_c3_r4");
    out.push("mov a,#0x09");
    out.push("ret");
    out.push("method_key_c3_r4:");
    out.push("cjne a,#0x07,method_key_none");
    out.push("mov a,#0x0b");
    out.push("ret");
    out.push("method_key_none:");
    out.push("mov a,#0xff");
    out.push("ret");
    out.push("");
}

function emitStaticDisplayRoutine(out) {
    out.push("static_display_l:");
    out.push("mov a,r6");
    out.push("anl a,#0x0f");
    out.push("call seg_digit_to_pattern");
    out.push("mov r7,a");
    out.push("mov r6,#0x01");
    out.push("call write");
    out.push("mov a,r6");
    out.push("swap a");
    out.push("anl a,#0x0f");
    out.push("call seg_digit_to_pattern");
    out.push("mov r7,a");
    out.push("mov r6,#0x02");
    out.push("call write");
    out.push("ret");
    out.push("static_display_h:");
    out.push("mov a,r6");
    out.push("anl a,#0x0f");
    out.push("call seg_digit_to_pattern");
    out.push("mov r7,a");
    out.push("mov r6,#0x03");
    out.push("call write");
    out.push("mov a,r6");
    out.push("swap a");
    out.push("anl a,#0x0f");
    out.push("call seg_digit_to_pattern");
    out.push("mov r7,a");
    out.push("mov r6,#0x04");
    out.push("call write");
    out.push("ret");
    out.push("static_display_low_byte:");
    out.push("call static_display_l");
    out.push("ret");
    out.push("");
}

function emitStepperRoutine(out) {
    out.push("stepper_halfstep:");
    out.push("; A=0 forward, non-zero reverse. Simple ST841 half-step state demo.");
    out.push("mov r5,a");
    out.push("mov a,0x2f");
    out.push("jz stepper_init_state");
    out.push("sjmp stepper_have_state");
    out.push("stepper_init_state:");
    out.push("mov a,#0x01");
    out.push("stepper_have_state:");
    out.push("cjne r5,#0x00,stepper_reverse");
    out.push("rl a");
    out.push("anl a,#0x0f");
    out.push("jnz stepper_save");
    out.push("mov a,#0x01");
    out.push("sjmp stepper_save");
    out.push("stepper_reverse:");
    out.push("rr a");
    out.push("anl a,#0x0f");
    out.push("jnz stepper_save");
    out.push("mov a,#0x08");
    out.push("stepper_save:");
    out.push("mov 0x2f,a");
    out.push("mov r7,a");
    out.push("mov r6,#0x08");
    out.push("call write");
    out.push("ret");
    out.push("stepper_v:");
    out.push("jz stepper_v_done");
    out.push("jnb acc.7,stepper_v_forward");
    out.push("mov a,#0x01");
    out.push("call stepper_halfstep");
    out.push("sjmp stepper_v_done");
    out.push("stepper_v_forward:");
    out.push("mov a,#0x00");
    out.push("call stepper_halfstep");
    out.push("stepper_v_done:");
    out.push("ret");
    out.push("");
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
