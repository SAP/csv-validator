sap.ui.define([], function () {
    "use strict";

    return class CSVValidator {
        static async validateCSV(file) {
            const result = {
                fileName: file.name,
                fileSize: file.size,
                isValid: false,
                totalRows: 0,
                hasWarnings: false,
                errors: [],
                invalidRows: [],
                warnings: [],
                encoding: 'UNKNOWN',
                stats: {
                    lines: 0,
                    columns: 0,
                    emptyLines: 0,
                    dataRows: 0,
                    maxFieldLength: 0,
                    duplicateHeaders: [],
                    nullBytes: 0
                },
                previewHeader: [],
                previewContent: [],
                correctedContent: ''
            };

            try {
                // Read file as ArrayBuffer for encoding detection
                const arrayBuffer = await this.readFileAsArrayBuffer(file);
                const uint8Array = new Uint8Array(arrayBuffer);

                // Check for null bytes (SuccessFactors requirement)
                const nullByteCheck = this.checkForNullBytes(uint8Array);
                result.stats.nullBytes = nullByteCheck.count;

                if (nullByteCheck.count > 0) {
                    result.errors.push(`File contains ${nullByteCheck.count} null byte(s) which will cause import failures. Position(s): ${nullByteCheck.positions.slice(0, 5).join(', ')}${nullByteCheck.positions.length > 5 ? '...' : ''}`);
                }

                // Detect encoding and BOM
                result.encoding = this.detectEncoding(uint8Array);

                // SuccessFactors requires UTF-8
                if (result.encoding !== 'UTF-8' && result.encoding !== 'UTF-8 (with BOM)') {
                    result.errors.push(`SuccessFactors requires UTF-8 encoding. Detected: ${result.encoding}. Please convert the file to UTF-8.`);
                }

                // Warn about BOM
                if (result.encoding === 'UTF-8 (with BOM)') {
                    result.warnings.push('File contains UTF-8 BOM. While supported, removing the BOM can improve compatibility.');
                }

                // Validate UTF-8
                const isValidUTF8 = this.validateUTF8(uint8Array, result.errors);

                if (isValidUTF8) {
                    // Read as text and validate structure
                    const text = await this.readFileAsText(file);

                    // SuccessFactors specific validations
                    this.validateFileSize(result);
                    this.validateLineEndings(text, result);
                    this.validateDelimiter(text, result);
                    this.validateCSVStructure(text, result);
                    this.generatePreview(text, result);

                    result.isValid = result.errors.length === 0;
                    result.hasWarnings = result.warnings.length > 0;
                }

            } catch (error) {
                result.errors.push(`Validation error: ${error.message}`);
            }

            return result;
        }

        static checkForNullBytes(uint8Array) {
            const positions = [];
            for (let i = 0; i < uint8Array.length; i++) {
                if (uint8Array[i] === 0x00) {
                    positions.push(i);
                }
            }
            return {
                count: positions.length,
                positions: positions
            };
        }

        static validateFileSize(result) {
            const maxFileSize = 100 * 1024 * 1024; // 100MB recommended
            const warningSize = 50 * 1024 * 1024; // 50MB warning threshold

            if (result.fileSize > maxFileSize) {
                result.errors.push(`File size (${(result.fileSize / 1024 / 1024).toFixed(2)}MB) exceeds SuccessFactors recommended limit of 100MB. Large files may fail to import or cause performance issues.`);
            } else if (result.fileSize > warningSize) {
                result.warnings.push(`File size (${(result.fileSize / 1024 / 1024).toFixed(2)}MB) is large. Files over 50MB may experience slower processing times.`);
            }
        }

        static validateLineEndings(text, result) {
            const crlfCount = (text.match(/\r\n/g) || []).length;
            const lfOnlyCount = (text.match(/(?<!\r)\n/g) || []).length;
            const crOnlyCount = (text.match(/\r(?!\n)/g) || []).length;

            if (crlfCount > 0 && lfOnlyCount === 0 && crOnlyCount === 0) {
                // All CRLF - ideal
                return;
            } else if (lfOnlyCount > 0 && crlfCount === 0 && crOnlyCount === 0) {
                // All LF - acceptable but warn
                result.warnings.push('File uses Unix line endings (LF). SuccessFactors prefers Windows line endings (CRLF) for best compatibility.');
            } else {
                // Mixed line endings - error
                result.errors.push(`Inconsistent line endings detected (CRLF: ${crlfCount}, LF: ${lfOnlyCount}, CR: ${crOnlyCount}). SuccessFactors requires consistent line endings throughout the file.`);
            }
        }

        static validateDelimiter(text, result) {
            // SuccessFactors Integration Center requires comma as delimiter
            const lines = text.split(/\r?\n/).slice(0, 10); // Check first 10 lines
            let semiColonCount = 0;
            let commaCount = 0;
            let tabCount = 0;
            let pipeCount = 0;

            lines.forEach(line => {
                semiColonCount += (line.match(/;/g) || []).length;
                commaCount += (line.match(/,/g) || []).length;
                tabCount += (line.match(/\t/g) || []).length;
                pipeCount += (line.match(/\|/g) || []).length;
            });

            if (semiColonCount > commaCount && semiColonCount > tabCount) {
                result.errors.push('File appears to use semicolon (;) as delimiter. SuccessFactors Integration Center requires comma (,) as the field delimiter.');
            } else if (tabCount > commaCount && tabCount > semiColonCount) {
                result.errors.push('File appears to use tab as delimiter. SuccessFactors Integration Center requires comma (,) as the field delimiter.');
            } else if (pipeCount > commaCount) {
                result.errors.push('File appears to use pipe (|) as delimiter. SuccessFactors Integration Center requires comma (,) as the field delimiter.');
            }
        }

        static readFileAsArrayBuffer(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }

        static readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file, 'utf-8');
            });
        }

        static detectEncoding(uint8Array) {
            if (uint8Array.length === 0) return 'EMPTY';

            // Check for BOM
            if (uint8Array.length >= 3 &&
                uint8Array[0] === 0xEF &&
                uint8Array[1] === 0xBB &&
                uint8Array[2] === 0xBF) {
                return 'UTF-8 (with BOM)';
            }

            if (uint8Array.length >= 2) {
                if (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
                    return 'UTF-16 BE';
                }
                if (uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
                    return 'UTF-16 LE';
                }
            }

            // Try UTF-8 decoding
            try {
                const decoder = new TextDecoder('utf-8', { fatal: true });
                decoder.decode(uint8Array);
                return 'UTF-8';
            } catch (e) {
                return 'Non-UTF-8';
            }
        }

        static validateUTF8(uint8Array, errors) {
            try {
                const decoder = new TextDecoder('utf-8', { fatal: true });
                const text = decoder.decode(uint8Array);

                if (text.includes('\uFFFD')) {
                    errors.push('File contains UTF-8 replacement characters indicating encoding corruption. Please save the file with proper UTF-8 encoding.');
                    return false;
                }

                return true;
            } catch (error) {
                errors.push(`Invalid UTF-8 encoding: ${error.message}. Please convert the file to UTF-8 encoding.`);
                return false;
            }
        }

        static validateCSVStructure(text, result) {
            const rows = this.parseCSVContent(text);
            let expectedColumns = -1;
            let headerProcessed = false;
            const correctedRows = [];
            const headerNames = new Set();
            const duplicateHeaders = [];
            let maxFieldLength = 0;

            result.stats.lines = rows.length;
            result.totalRows = rows.length;

            // SuccessFactors: Check for minimum rows
            if (rows.length < 2) {
                result.errors.push('CSV file must contain at least a header row and one data row for import.');
            }

            // SuccessFactors: Check for maximum rows (recommendation)
            if (rows.length > 1000000) {
                result.warnings.push(`File contains ${rows.length.toLocaleString()} rows. Files with more than 1 million rows may experience performance issues. Consider splitting into multiple files.`);
            }

            for (let i = 0; i < rows.length; i++) {
                const originalRow = rows[i];
                const columns = originalRow.columns;

                if (columns.length === 0 || (columns.length === 1 && columns[0].trim() === '')) {
                    result.stats.emptyLines++;
                    continue;
                }

                if (!headerProcessed) {
                    expectedColumns = columns.length;
                    result.stats.columns = expectedColumns;
                    headerProcessed = true;

                    // SuccessFactors: Validate headers
                    const headerValidation = this.validateHeaders(columns, result);
                    correctedRows.push(headerValidation.correctedRow);

                    // Check for duplicate headers (case-insensitive)
                    columns.forEach((col, idx) => {
                        const trimmedCol = col.trim();
                        if (trimmedCol === '') {
                            result.errors.push(`Header column ${idx + 1} is empty. SuccessFactors requires all columns to have unique names.`);
                        } else {
                            const lowerCol = trimmedCol.toLowerCase();
                            if (headerNames.has(lowerCol)) {
                                duplicateHeaders.push(trimmedCol);
                                result.errors.push(`Duplicate header found: "${trimmedCol}" (column ${idx + 1}). SuccessFactors requires unique column names.`);
                            }
                            headerNames.add(lowerCol);
                        }
                    });

                    result.stats.duplicateHeaders = duplicateHeaders;

                } else {
                    result.stats.dataRows++;

                    // Validate and correct the row
                    const validation = this.validateAndCorrectRow(originalRow, expectedColumns, i + 1, result);

                    // Track max field length
                    validation.columns.forEach(col => {
                        if (col.length > maxFieldLength) {
                            maxFieldLength = col.length;
                        }
                    });

                    if (validation.hasIssues || validation.hasMultiLine) {
                        if (validation.hasIssues) {
                            result.invalidRows.push({
                                rowNumber: i + 1,
                                issueType: validation.issueType,
                                originalContent: validation.original,
                                suggestedFix: validation.corrected
                            });
                        }
                        correctedRows.push(validation.corrected);
                    } else {
                        correctedRows.push(originalRow.raw);
                    }

                    if (columns.length !== expectedColumns) {
                        result.errors.push(
                            `Line ${i + 1}: Expected ${expectedColumns} columns, found ${columns.length}. SuccessFactors requires consistent column count across all rows.`
                        );
                    }

                    // SuccessFactors: Check for extremely long fields
                    columns.forEach((col, idx) => {
                        if (col.length > 4000) {
                            result.errors.push(`Line ${i + 1}, Column ${idx + 1}: Field length (${col.length} characters) exceeds SuccessFactors limit of 4000 characters. Data will be truncated during import.`);
                        } else if (col.length > 2000) {
                            result.warnings.push(`Line ${i + 1}, Column ${idx + 1}: Field length (${col.length} characters) is very long. Verify field mapping supports this length.`);
                        }
                    });

                    // Check for empty required-looking fields (first column)
                    if (columns[0] && columns[0].trim() === '') {
                        result.warnings.push(`Line ${i + 1}: First column is empty. If this is a key field, the row will fail to import.`);
                    }
                }
            }

            result.stats.maxFieldLength = maxFieldLength;

            if (maxFieldLength > 4000) {
                result.errors.push(`Maximum field length detected: ${maxFieldLength} characters. SuccessFactors has a limit of 4000 characters per field.`);
            }

            result.correctedContent = correctedRows.join('\n');

            if (result.stats.dataRows === 0) {
                result.errors.push('File contains no data rows (only headers or empty lines). SuccessFactors requires at least one data row for import.');
            }

            if (result.stats.emptyLines > result.stats.lines * 0.1) {
                result.warnings.push(`File contains ${result.stats.emptyLines} empty lines (${Math.round(result.stats.emptyLines / result.stats.lines * 100)}%). Consider removing them for cleaner data.`);
            }

            // SuccessFactors: Check for too many columns
            if (expectedColumns > 300) {
                result.warnings.push(`File has ${expectedColumns} columns. Files with more than 300 columns may experience performance issues in SuccessFactors.`);
            }

            // Check for minimum columns
            if (expectedColumns < 1) {
                result.errors.push('File must contain at least one column with a header.');
            }
        }

        static validateHeaders(columns, result) {
            const correctedColumns = [];
            let hasLeadingSpaces = false;
            let hasTrailingSpaces = false;

            columns.forEach((col, idx) => {
                let corrected = col;

                // Check for leading/trailing spaces
                if (col !== col.trim()) {
                    if (col.startsWith(' ') || col.startsWith('\t')) {
                        hasLeadingSpaces = true;
                    }
                    if (col.endsWith(' ') || col.endsWith('\t')) {
                        hasTrailingSpaces = true;
                    }
                    result.warnings.push(`Header column ${idx + 1} ("${col}") has leading or trailing whitespace. This may cause field mapping issues.`);
                    corrected = col.trim();
                }

                // Check for invalid characters in headers
                const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/g;
                if (invalidChars.test(corrected)) {
                    result.errors.push(`Header column ${idx + 1} ("${corrected}") contains invalid characters. SuccessFactors headers should use alphanumeric characters, underscores, and hyphens only.`);
                    corrected = corrected.replace(invalidChars, '_');
                }

                // Check for special characters that may cause issues
                if (/[!@#$%^&*()+=\[\]{};':",.<>?\/\\|`~]/.test(corrected)) {
                    result.warnings.push(`Header column ${idx + 1} ("${corrected}") contains special characters. Consider using simpler names for better compatibility.`);
                }

                // Check for numeric-only headers
                if (/^\d+$/.test(corrected)) {
                    result.warnings.push(`Header column ${idx + 1} is numeric only ("${corrected}"). Use descriptive names for better field mapping.`);
                }

                // Check for very long header names
                if (corrected.length > 100) {
                    result.warnings.push(`Header column ${idx + 1} is very long (${corrected.length} characters). Consider using shorter, more concise names.`);
                }

                correctedColumns.push(corrected);
            });

            return {
                correctedRow: correctedColumns.join(','),
                hasIssues: hasLeadingSpaces || hasTrailingSpaces
            };
        }

        static parseCSVContent(text) {
            const rows = [];
            const lines = text.split(/\r?\n/);
            let currentRow = '';
            let inQuotes = false;
            let startLineNumber = 1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (!inQuotes && currentRow === '') {
                    startLineNumber = i + 1;
                }

                if (currentRow !== '' && inQuotes) {
                    currentRow += '\n' + line;
                } else {
                    currentRow += line;
                }

                let quoteCount = 0;
                let j = 0;
                while (j < currentRow.length) {
                    if (currentRow[j] === '"') {
                        if (j + 1 < currentRow.length && currentRow[j + 1] === '"') {
                            j += 2;
                        } else {
                            quoteCount++;
                            j++;
                        }
                    } else {
                        j++;
                    }
                }

                inQuotes = (quoteCount % 2 !== 0);

                if (!inQuotes) {
                    if (currentRow.trim()) {
                        const parsed = this.parseCSVLine(currentRow);
                        rows.push({
                            lineNumber: startLineNumber,
                            raw: currentRow,
                            columns: parsed.columns,
                            wasQuoted: parsed.wasQuoted
                        });
                    }
                    currentRow = '';
                }
            }

            if (currentRow.trim()) {
                const parsed = this.parseCSVLine(currentRow);
                rows.push({
                    lineNumber: startLineNumber,
                    raw: currentRow,
                    columns: parsed.columns,
                    wasQuoted: parsed.wasQuoted
                });
            }

            return rows;
        }

        static parseCSVLine(line) {
            const columns = [];
            const wasQuoted = [];
            let current = '';
            let inQuotes = false;
            let fieldStartedWithQuote = false;
            let i = 0;

            while (i < line.length) {
                const char = line[i];

                if (char === '"') {
                    if (!inQuotes) {
                        inQuotes = true;
                        fieldStartedWithQuote = true;
                        i++;
                    } else if (i + 1 < line.length && line[i + 1] === '"') {
                        current += '"';
                        i += 2;
                    } else {
                        inQuotes = false;
                        i++;
                    }
                } else if (char === ',' && !inQuotes) {
                    columns.push(current);
                    wasQuoted.push(fieldStartedWithQuote);
                    current = '';
                    fieldStartedWithQuote = false;
                    i++;
                } else {
                    current += char;
                    i++;
                }
            }

            columns.push(current);
            wasQuoted.push(fieldStartedWithQuote);

            return { columns, wasQuoted };
        }

        static validateAndCorrectRow(rowData, expectedColumns, rowNumber, result) {
            const columns = rowData.columns;
            const wasQuoted = rowData.wasQuoted || [];
            let hasIssues = false;
            let hasMultiLine = false;
            let issueTypes = [];
            const correctedColumns = [];

            for (let i = 0; i < columns.length; i++) {
                let value = columns[i];
                const originalValue = value;
                const wasThisFieldQuoted = wasQuoted[i] || false;
                let fieldHasIssues = false;
                const fieldErrors = [];

                // **Add space after fullstop if missing (applies to all fields)**
                value = value.replace(/\.(?=[^\s.])/g, '. ');

                // Check for leading/trailing spaces in data
                if (value !== value.trim() && value.trim() !== '') {
                    result.warnings.push(`Line ${rowNumber}, Column ${i + 1}: Field has leading or trailing whitespace which may cause data quality issues.`);
                }

                // Check for control characters (except newline/tab in quoted fields)
                const controlCharPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
                if (controlCharPattern.test(value)) {
                    fieldErrors.push('contains control characters');
                    fieldHasIssues = true;
                    result.errors.push(`Line ${rowNumber}, Column ${i + 1}: Contains invalid control characters that will cause import failures.`);
                }

                // Check for HTML tags
                const htmlTagPattern = /<[^>]*>/g;
                if (htmlTagPattern.test(value)) {
                    fieldErrors.push('contains HTML tags');
                    fieldHasIssues = true;
                }

                // Check for HTML entities
                if (this.containsHTMLEntities(value)) {
                    fieldErrors.push('contains HTML entities');
                    fieldHasIssues = true;
                }

                // Check for problematic characters (smart quotes, em dashes, etc.)
                const problematicChars = this.checkProblematicCharacters(value);
                if (problematicChars.length > 0) {
                    fieldErrors.push(`contains problematic characters: ${problematicChars.join(', ')}`);
                    fieldHasIssues = true;
                }

                // Check for unescaped special characters - but only if field was NOT quoted
                if (!wasThisFieldQuoted) {
                    const unescapedIssues = this.checkUnescapedCharacters(value);
                    if (unescapedIssues.length > 0) {
                        fieldErrors.push(...unescapedIssues);
                        fieldHasIssues = true;
                    }
                }

                if (fieldHasIssues) {
                    hasIssues = true;
                    const errorMessage = `Line ${rowNumber}, Column ${i + 1}: ${fieldErrors.join(', ')}`;
                    result.errors.push(errorMessage);
                    issueTypes.push(...fieldErrors);

                    value = this.correctFieldContent(value);
                }

                const isMultiLine = this.isMultiLine(value);
                if (isMultiLine) {
                    hasMultiLine = true;
                }

                correctedColumns.push({
                    value: value,
                    needsQuoting: fieldHasIssues || wasThisFieldQuoted || this.needsQuoting(value),
                    isMultiLine: isMultiLine
                });
            }

            const correctedRow = correctedColumns.map(col => {
                if (col.needsQuoting) {
                    let fieldValue = col.value;
                    if (col.isMultiLine) {
                        fieldValue = '\\' + fieldValue + '\\';
                    }
                    return this.escapeAndQuoteField(fieldValue);
                } else {
                    return col.value;
                }
            }).join(',');

            return {
                hasIssues: hasIssues,
                hasMultiLine: hasMultiLine,
                issueType: issueTypes.length > 0 ? [...new Set(issueTypes)].join('; ') : 'No issues',
                original: rowData.raw,
                corrected: correctedRow,
                columns: correctedColumns.map(col => col.value)
            };
        }

        static checkProblematicCharacters(value) {
            var issues = [];
            var problematicChars = {
                '\u2018': 'left single quotation mark',
                '\u2019': 'right single quotation mark',
                '\u201C': 'left double quotation mark',
                '\u201D': 'right double quotation mark',
                '\u2013': 'en dash',
                '\u2014': 'em dash',
                '\u2026': 'ellipsis',
                '\u00A0': 'non-breaking space'
            };

            var chars = Object.keys(problematicChars);
            for (var i = 0; i < chars.length; i++) {
                var char = chars[i];
                if (value.indexOf(char) !== -1) {
                    issues.push(problematicChars[char]);
                }
            }

            return issues;
        }

        static needsQuoting(value) {
            return value.includes(',') ||
                value.includes('"') ||
                value.includes('\n') ||
                value.includes('\r');
        }

        static isMultiLine(value) {
            return value.includes('\n') || value.includes('\r');
        }

        static checkUnescapedCharacters(value) {
            const issues = [];

            if (value.includes(',')) {
                issues.push('contains unescaped commas (should be quoted)');
            }
            if (value.includes('"')) {
                issues.push('contains unescaped quotes (should be quoted and escaped)');
            }
            if (value.includes('\n') || value.includes('\r')) {
                issues.push('contains unescaped newlines (should be quoted)');
            }

            return issues;
        }

        static correctFieldContent(value) {
            // Step 1: Remove paragraph tags first
            value = value.replace(/<\/?p>/gi, '');

            // Step 2: Remove sentences containing anchor tags
            // This regex finds: any text + <a...>...</a> + text until period
            value = value.replace(/[^.!?]*<a[^>]*>.*?<\/a>[^.!?]*\./gi, '');

            // Step 3: Clean up if we're left with leading period/space
            value = value.replace(/^\s*\.\s*/, '');

            // Step 4: Remove any remaining HTML tags
            value = value.replace(/<[^>]*>/g, '');

            // Step 5: Decode HTML entities
            value = this.decodeHTMLEntities(value);

            // Step 6: Replace smart quotes with regular quotes
            value = value.replace(/[\u2018\u2019]/g, "'");
            value = value.replace(/[\u201C\u201D]/g, '"');

            // Step 7: Replace em/en dashes with regular hyphens
            value = value.replace(/[\u2013\u2014]/g, '-');

            // Step 8: Replace ellipsis
            value = value.replace(/\u2026/g, '...');

            // Step 9: Replace non-breaking spaces
            value = value.replace(/\u00A0/g, ' ');

            // Step 10: Remove control characters
            value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

            // Step 11: Clean up whitespace
            value = value.replace(/\s+/g, ' ').trim();

            return value;

        }

        static containsHTMLEntities(value) {
            // Match HTML entities anywhere in the text, including within words
            return /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/.test(value);
        }

        static decodeHTMLEntities(text) {
            const entities = {
                '&quot;': '"',
                '&apos;': "'",
                '&lt;': '<',
                '&gt;': '>',
                '&amp;': '&',
                '&nbsp;': ' ',
                '&auml;': 'ä',
                '&ouml;': 'ö',
                '&uuml;': 'ü',
                '&Auml;': 'Ä',
                '&Ouml;': 'Ö',
                '&Uuml;': 'Ü',
                '&szlig;': 'ß',
                '&ndash;': '–',
                '&mdash;': '—',
                '&euro;': '€',
                '&lsquo;': '\u2018',
                '&rsquo;': '\u2019',
                '&ldquo;': '\u201C',
                '&rdquo;': '\u201D',
                '&bdquo;': '\u201E',
                '&hellip;': '\u2026',
                // Additional common German/European entities
                '&Agrave;': 'À',
                '&Aacute;': 'Á',
                '&Acirc;': 'Â',
                '&Atilde;': 'Ã',
                '&Aring;': 'Å',
                '&AElig;': 'Æ',
                '&Ccedil;': 'Ç',
                '&Egrave;': 'È',
                '&Eacute;': 'É',
                '&Ecirc;': 'Ê',
                '&Euml;': 'Ë',
                '&Igrave;': 'Ì',
                '&Iacute;': 'Í',
                '&Icirc;': 'Î',
                '&Iuml;': 'Ï',
                '&Ntilde;': 'Ñ',
                '&Ograve;': 'Ò',
                '&Oacute;': 'Ó',
                '&Ocirc;': 'Ô',
                '&Otilde;': 'Õ',
                '&Oslash;': 'Ø',
                '&Ugrave;': 'Ù',
                '&Uacute;': 'Ú',
                '&Ucirc;': 'Û',
                '&Yacute;': 'Ý',
                '&agrave;': 'à',
                '&aacute;': 'á',
                '&acirc;': 'â',
                '&atilde;': 'ã',
                '&aring;': 'å',
                '&aelig;': 'æ',
                '&ccedil;': 'ç',
                '&egrave;': 'è',
                '&eacute;': 'é',
                '&ecirc;': 'ê',
                '&euml;': 'ë',
                '&igrave;': 'ì',
                '&iacute;': 'í',
                '&icirc;': 'î',
                '&iuml;': 'ï',
                '&ntilde;': 'ñ',
                '&ograve;': 'ò',
                '&oacute;': 'ó',
                '&ocirc;': 'ô',
                '&otilde;': 'õ',
                '&oslash;': 'ø',
                '&ugrave;': 'ù',
                '&uacute;': 'ú',
                '&ucirc;': 'û',
                '&yacute;': 'ý',
                '&yuml;': 'ÿ'
            };

            // Replace named entities (works within words like f&uuml;r)
            let decoded = text.replace(/&[a-zA-Z]+;/g, match => entities[match] || match);

            // Replace numeric entities (decimal)
            decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
                try {
                    return String.fromCharCode(parseInt(dec, 10));
                } catch (e) {
                    return match; // Keep original if conversion fails
                }
            });

            // Replace numeric entities (hexadecimal)
            decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
                try {
                    return String.fromCharCode(parseInt(hex, 16));
                } catch (e) {
                    return match; // Keep original if conversion fails
                }
            });

            return decoded;
        }

        static escapeAndQuoteField(value) {
            let processed = value;
            processed = processed.replace(/"/g, '\\"');  // Escape quotes with backslash
            return '"' + processed + '"';
        }


        static generatePreview(text, result) {
            const rows = this.parseCSVContent(text);
            const previewRows = rows.slice(0, Math.min(11, rows.length));

            if (previewRows.length > 0) {
                const headers = previewRows[0].columns;
                result.previewHeader = [headers];

                const aData = [];
                for (let i = 1; i < previewRows.length; i++) {
                    const cells = previewRows[i].columns;
                    const oRow = {};
                    for (let j = 0; j < headers.length; j++) {
                        oRow[headers[j] || "Column" + (j + 1)] = cells[j] || "";
                    }
                    aData.push(oRow);
                }
                result.previewContent = aData;
            }
        }
    };
});