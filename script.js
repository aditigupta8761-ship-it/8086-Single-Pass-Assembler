/* =========================================================
   8086 SINGLE PASS ASSEMBLER
   JavaScript Implementation
   ========================================================= */


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let symbolTable = {};

let fixupTable = [];

let machineCode = [];

let locationCounter = 0;

let errors = [];

let instructionCount = 0;


/* =========================================================
   REGISTER CODES
   ========================================================= */

const registers = {

    AX: 0,
    CX: 1,
    DX: 2,
    BX: 3,
    SP: 4,
    BP: 5,
    SI: 6,
    DI: 7

};


/* =========================================================
   GET REGISTER CODE
   ========================================================= */

function getRegisterCode(reg) {

    reg = reg.toUpperCase();

    if (registers.hasOwnProperty(reg)) {

        return registers[reg];

    }

    return -1;
}


/* =========================================================
   NUMBER CONVERSION
   ========================================================= */

function getNumber(value) {

    value = value.toUpperCase().trim();

    /* Hexadecimal */

    if (value.endsWith("H")) {

        let hex =
            value.substring(
                0,
                value.length - 1
            );

        if (/^[0-9A-F]+$/.test(hex)) {

            return parseInt(hex, 16);

        }

    }

    /* Decimal */

    if (/^-?\d+$/.test(value)) {

        return parseInt(value, 10);

    }

    return null;
}


/* =========================================================
   ADD BYTE
   ========================================================= */

function addByte(value) {

    machineCode.push(
        value & 0xFF
    );

    locationCounter++;

}


/* =========================================================
   PROCESS INSTRUCTION
   ========================================================= */

function processInstruction(line, lineNumber) {

    line = line
        .replace(/,/g, " ")
        .trim();

    if (line === "") {

        return;

    }


    let parts =
        line.split(/\s+/);


    let mnemonic =
        parts[0].toUpperCase();


    let op1 =
        parts[1]
            ? parts[1].toUpperCase()
            : "";


    let op2 =
        parts[2]
            ? parts[2].toUpperCase()
            : "";


    /* =====================================================
       MOV REGISTER, REGISTER
       ===================================================== */

    if (
        mnemonic === "MOV" &&
        getRegisterCode(op1) !== -1 &&
        getRegisterCode(op2) !== -1
    ) {

        let r1 =
            getRegisterCode(op1);

        let r2 =
            getRegisterCode(op2);


        /*
            MOV r16,r16

            Opcode = 8B /r

            Mod = 11
            Reg = destination
            R/M = source
        */


        let modrm =
            0xC0 |
            (r1 << 3) |
            r2;


        addByte(0x8B);

        addByte(modrm);

        instructionCount++;

        return;
    }


    /* =====================================================
       MOV REGISTER, IMMEDIATE
       ===================================================== */

    if (
        mnemonic === "MOV" &&
        getRegisterCode(op1) !== -1
    ) {

        let immediate =
            getNumber(op2);


        if (immediate !== null) {

            let reg =
                getRegisterCode(op1);


            /*
                MOV r16, immediate

                B8 + register
            */


            addByte(
                0xB8 + reg
            );


            addByte(
                immediate & 0xFF
            );


            addByte(
                (immediate >> 8) & 0xFF
            );


            instructionCount++;

            return;
        }

    }


    /* =====================================================
       ADD REGISTER, REGISTER
       ===================================================== */

    if (
        mnemonic === "ADD" &&
        getRegisterCode(op1) !== -1 &&
        getRegisterCode(op2) !== -1
    ) {

        let r1 =
            getRegisterCode(op1);

        let r2 =
            getRegisterCode(op2);


        let modrm =
            0xC0 |
            (r1 << 3) |
            r2;


        addByte(0x03);

        addByte(modrm);

        instructionCount++;

        return;
    }


    /* =====================================================
       SUB REGISTER, REGISTER
       ===================================================== */

    if (
        mnemonic === "SUB" &&
        getRegisterCode(op1) !== -1 &&
        getRegisterCode(op2) !== -1
    ) {

        let r1 =
            getRegisterCode(op1);

        let r2 =
            getRegisterCode(op2);


        let modrm =
            0xC0 |
            (r1 << 3) |
            r2;


        addByte(0x2B);

        addByte(modrm);

        instructionCount++;

        return;
    }


    /* =====================================================
       INC REGISTER
       ===================================================== */

    if (
        mnemonic === "INC" &&
        getRegisterCode(op1) !== -1
    ) {

        let reg =
            getRegisterCode(op1);


        addByte(
            0x40 + reg
        );


        instructionCount++;

        return;
    }


    /* =====================================================
       DEC REGISTER
       ===================================================== */

    if (
        mnemonic === "DEC" &&
        getRegisterCode(op1) !== -1
    ) {

        let reg =
            getRegisterCode(op1);


        addByte(
            0x48 + reg
        );


        instructionCount++;

        return;
    }


    /* =====================================================
       JMP LABEL
       ===================================================== */

    if (
        mnemonic === "JMP" &&
        op1 !== ""
    ) {

        /*
            Near JMP

            Opcode = E9

            Followed by 16-bit displacement
        */


        addByte(0xE9);


        let target =
            getNumber(op1);


        if (target !== null) {

            let displacement =
                target -
                (locationCounter + 2);


            addByte(
                displacement & 0xFF
            );


            addByte(
                (displacement >> 8) & 0xFF
            );


        } else {


            /*
                Forward reference

                Address is not known yet.

                Reserve two bytes.
            */


            fixupTable.push({

                symbol: op1,

                patchAddress:
                    locationCounter,

                instructionAddress:
                    locationCounter - 1

            });


            addByte(0x00);

            addByte(0x00);

        }


        instructionCount++;

        return;
    }


    /* =====================================================
       UNKNOWN INSTRUCTION
       ===================================================== */

    errors.push(
        `Line ${lineNumber}: Unknown or invalid instruction → ${line}`
    );

}


/* =========================================================
   BACKPATCHING
   ========================================================= */

function performBackpatching() {

    fixupTable.forEach(
        fixup => {

            let symbol =
                symbolTable[
                    fixup.symbol
                ];


            if (!symbol) {

                errors.push(
                    `Undefined symbol: ${fixup.symbol}`
                );

                fixup.status =
                    "Undefined";

                return;

            }


            /*
                JMP instruction size = 3

                displacement =
                target -
                address after instruction
            */


            let displacement =
                symbol.address -
                (
                    fixup.instructionAddress +
                    3
                );


            machineCode[
                fixup.patchAddress
            ] =
                displacement & 0xFF;


            machineCode[
                fixup.patchAddress + 1
            ] =
                (
                    displacement >> 8
                ) & 0xFF;


            fixup.status =
                "Patched";

        }
    );

}


/* =========================================================
   ASSEMBLE PROGRAM
   ========================================================= */

function assembleCode() {

    /* Reset */

    symbolTable = {};

    fixupTable = [];

    machineCode = [];

    locationCounter = 0;

    errors = [];

    instructionCount = 0;


    let source =
        document
            .getElementById(
                "sourceCode"
            )
            .value;


    let lines =
        source.split("\n");


    /* =====================================================
       SINGLE PASS
       ===================================================== */

    lines.forEach(
        (originalLine, index) => {

            let line =
                originalLine.trim();


            let lineNumber =
                index + 1;


            /* Empty line */

            if (line === "") {

                return;

            }


            /* Comment */

            if (line.startsWith(";")) {

                return;

            }


            /*
                Remove comments
            */

            line =
                line.split(";")[0].trim();


            /*
                Check for label
            */

            if (line.includes(":")) {

                let parts =
                    line.split(":");


                let label =
                    parts[0]
                        .trim()
                        .toUpperCase();


                /*
                    Store label address
                */

                if (
                    symbolTable.hasOwnProperty(
                        label
                    )
                ) {

                    errors.push(
                        `Line ${lineNumber}: Duplicate label ${label}`
                    );

                } else {

                    symbolTable[label] = {

                        address:
                            locationCounter,

                        defined:
                            true

                    };

                }


                /*
                    Process instruction
                    after label
                */

                line =
                    parts
                        .slice(1)
                        .join(":")
                        .trim();


                if (line === "") {

                    return;

                }

            }


            /*
                Process instruction
            */

            processInstruction(
                line,
                lineNumber
            );

        }
    );


    /* =====================================================
       BACKPATCHING
       ===================================================== */

    performBackpatching();


    /* =====================================================
       UPDATE GUI
       ===================================================== */

    displayMachineCode();

    displaySymbolTable();

    displayFixupTable();

    displayErrors();

    updateStatistics();

}


/* =========================================================
   DISPLAY MACHINE CODE
   ========================================================= */

function displayMachineCode() {

    let output =
        document.getElementById(
            "machineCode"
        );


    if (machineCode.length === 0) {

        output.innerHTML =
            `<div class="empty">
                No machine code generated.
             </div>`;

        return;

    }


    let hex =
        machineCode
            .map(
                byte =>
                    byte
                        .toString(16)
                        .toUpperCase()
                        .padStart(2, "0")
            )
            .join(" ");


    output.innerHTML =
        `<div>${hex}</div>`;

}


/* =========================================================
   DISPLAY SYMBOL TABLE
   ========================================================= */

function displaySymbolTable() {

    let table =
        document.getElementById(
            "symbolTable"
        );


    table.innerHTML = "";


    let symbols =
        Object.keys(
            symbolTable
        );


    if (symbols.length === 0) {

        table.innerHTML =
            `<tr>
                <td colspan="3"
                    class="empty-cell">
                    No symbols
                </td>
             </tr>`;

        return;

    }


    symbols.forEach(
        symbol => {

            let data =
                symbolTable[symbol];


            let row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>${symbol}</td>

                <td>
                    ${data.address}
                    <span style="color:#64748b">
                        (0x${data.address
                            .toString(16)
                            .toUpperCase()})
                    </span>
                </td>

                <td>
                    YES
                </td>

            `;


            table.appendChild(row);

        }
    );

}


/* =========================================================
   DISPLAY FIXUP TABLE
   ========================================================= */

function displayFixupTable() {

    let table =
        document.getElementById(
            "fixupTable"
        );


    table.innerHTML = "";


    if (fixupTable.length === 0) {

        table.innerHTML =
            `<tr>
                <td colspan="3"
                    class="empty-cell">
                    No forward references
                </td>
             </tr>`;

        return;

    }


    fixupTable.forEach(
        fixup => {

            let row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${fixup.symbol}
                </td>

                <td>
                    ${fixup.patchAddress}
                </td>

                <td>
                    <span style="color:#4ade80">
                        ${fixup.status || "Pending"}
                    </span>
                </td>

            `;


            table.appendChild(row);

        }
    );

}


/* =========================================================
   DISPLAY ERRORS
   ========================================================= */

function displayErrors() {

    let output =
        document.getElementById(
            "errorOutput"
        );


    output.innerHTML = "";


    if (errors.length === 0) {

        output.innerHTML =
            `<div class="message success">
                ✓ Assembly completed successfully.
             </div>`;

        return;

    }


    errors.forEach(
        error => {

            let div =
                document.createElement(
                    "div"
                );


            div.className =
                "message error";


            div.textContent =
                "✗ " + error;


            output.appendChild(div);

        }
    );

}


/* =========================================================
   UPDATE STATISTICS
   ========================================================= */

function updateStatistics() {

    document.getElementById(
        "instructionCount"
    ).textContent =
        instructionCount;


    document.getElementById(
        "symbolCount"
    ).textContent =
        Object.keys(
            symbolTable
        ).length;


    document.getElementById(
        "byteCount"
    ).textContent =
        machineCode.length;


    document.getElementById(
        "errorCount"
    ).textContent =
        errors.length;

}


/* =========================================================
   LOAD EXAMPLE
   ========================================================= */

function loadExample() {

    let example = `MOV AX, 1234H
MOV BX, AX
ADD AX, BX
INC AX
JMP LOOP
MOV CX, 0005H

LOOP:
DEC CX
SUB AX, BX`;


    document.getElementById(
        "sourceCode"
    ).value = example;


    updateLineNumbers();


    document.querySelector(
        ".status"
    ).innerHTML =
        `<span class="status-dot"></span>
         Example Loaded`;

}


/* =========================================================
   CLEAR
   ========================================================= */

function clearAll() {

    document.getElementById(
        "sourceCode"
    ).value = "";


    document.getElementById(
        "machineCode"
    ).innerHTML =
        `<div class="empty">
            Machine code will appear here...
         </div>`;


    document.getElementById(
        "symbolTable"
    ).innerHTML =
        `<tr>
            <td colspan="3"
                class="empty-cell">
                No symbols yet
            </td>
         </tr>`;


    document.getElementById(
        "fixupTable"
    ).innerHTML =
        `<tr>
            <td colspan="3"
                class="empty-cell">
                No forward references
            </td>
         </tr>`;


    document.getElementById(
        "errorOutput"
    ).innerHTML =
        `<div class="message success">
            ✓ Ready to assemble your program.
         </div>`;


    document.getElementById(
        "instructionCount"
    ).textContent = "0";


    document.getElementById(
        "symbolCount"
    ).textContent = "0";


    document.getElementById(
        "byteCount"
    ).textContent = "0";


    document.getElementById(
        "errorCount"
    ).textContent = "0";


    updateLineNumbers();

}


/* =========================================================
   LINE NUMBERS
   ========================================================= */

function updateLineNumbers() {

    let text =
        document.getElementById(
            "sourceCode"
        ).value;


    let lines =
        text.split("\n").length;


    let numbers = "";


    for (
        let i = 1;
        i <= lines;
        i++
    ) {

        numbers += i + "<br>";

    }


    document.getElementById(
        "lineNumbers"
    ).innerHTML =
        numbers;

}


/* =========================================================
   DOWNLOAD SOURCE CODE
   ========================================================= */

function downloadCode() {

    let source =
        document.getElementById(
            "sourceCode"
        ).value;


    if (!source.trim()) {

        alert(
            "Please enter assembly code first."
        );

        return;

    }


    let blob =
        new Blob(
            [source],
            {
                type:
                    "text/plain"
            }
        );


    let url =
        URL.createObjectURL(
            blob
        );


    let link =
        document.createElement(
            "a"
        );


    link.href = url;

    link.download =
        "input.asm";


    link.click();


    URL.revokeObjectURL(
        url
    );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

window.onload = function () {

    loadExample();

    updateLineNumbers();

};