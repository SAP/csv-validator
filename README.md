[![REUSE status](https://api.reuse.software/badge/github.com/SAP/csv-validator)](https://api.reuse.software/info/github.com/SAP/csv-validator)

# csv-validator

## About this project

{The tool validates CSV files in a format that is consumable by SAP SuccessFactors integration center in its initial use case, but the tool can be used for other SAP solutions. Comma-separated values (CSV) are plain text files (.csv) used for storing structured, tabular data, where each line represents a row and commas separate fields. CSV validation is used for data exchange.}

## Requirements and Setup

An SAP Fiori application.

### Running the app locally
- Clone the repository
- Go to folder stucture
- Start powershell
- Run the following commands
```
    npm install
```

### Starting the generated app

-   This app has been generated using the SAP Fiori tools - App Generator, as part of the SAP Fiori tools suite.  To launch the generated application, run the following from the generated application root folder:

```
    npm start
```

### Text Cleansing Operations

# CSV Validation Checks Summary

This CSV validator performs comprehensive checks specifically tailored for **SuccessFactors Integration Center** requirements. Here's what it validates:

## Main Validation Checks:

1. **File Encoding Detection & Validation**
   - Detects file encoding (UTF-8, UTF-16, etc.)
   - Checks for Byte Order Mark (BOM)
   - Validates UTF-8 compliance

2. **File Size Validation**
   - Checks against recommended size limits

3. **Null Bytes Check**
   - Scans for null bytes (0x00) in the file

4. **Line Endings Validation**
   - Checks for consistent line endings (CRLF, LF, CR)

5. **Delimiter Validation**
   - Ensures comma is used as the delimiter (not semicolon, tab, or pipe)

6. **CSV Structure Validation**
   - Validates row count (minimum and maximum)
   - Checks column consistency across all rows
   - Validates header structure and names
   - Checks for duplicate headers
   - Validates field lengths
   - Checks for empty required fields

7. **Header Validation**
   - Checks for leading/trailing whitespace
   - Validates against invalid characters
   - Checks for special characters
   - Validates numeric-only headers
   - Checks header name length

8. **Data Field Validation**
   - Checks for control characters
   - Detects HTML tags
   - Detects HTML entities
   - Identifies problematic characters (smart quotes, em dashes, etc.)
   - Validates proper quoting/escaping of special characters
   - Checks for multi-line content

---

## Errors Captured:

| Error | Description |
|-------|-------------|
| **Null bytes detected** | File contains null bytes (0x00) that will cause import failures; shows count and positions |
| **Incorrect encoding** | File is not UTF-8 encoded (SuccessFactors requirement) |
| **UTF-8 corruption** | File contains replacement characters (�) indicating encoding corruption |
| **Invalid UTF-8** | File has invalid UTF-8 byte sequences |
| **File too small** | Less than 2 rows (header + at least one data row required) |
| **File too large** | Exceeds 100MB recommended limit |
| **Mixed line endings** | Inconsistent line endings throughout the file (mix of CRLF, LF, CR) |
| **Wrong delimiter** | Uses semicolon, tab, or pipe instead of comma |
| **Column count mismatch** | Row has different number of columns than header |
| **Field too long** | Field exceeds 4000 character limit |
| **Empty header column** | Header column is blank (all columns need unique names) |
| **Duplicate headers** | Multiple columns with the same name (case-insensitive check) |
| **Invalid header characters** | Headers contain invalid characters like `<>:"\/\|?*` or control characters |
| **No data rows** | File contains only headers or empty lines |
| **Too few columns** | File has no columns with headers |
| **Control characters in data** | Data fields contain invalid control characters (0x00-0x1F excluding tab/newline) |
| **Unescaped special characters** | Fields contain unescaped commas, quotes, or newlines without proper quoting |

---

## Warnings Captured:

| Warning | Description |
|---------|-------------|
| **UTF-8 BOM present** | File has UTF-8 BOM; removing it can improve compatibility |
| **Large file size** | File is between 50-100MB; may experience slower processing |
| **Unix line endings** | File uses LF instead of preferred CRLF |
| **Header whitespace** | Header has leading/trailing whitespace that may cause field mapping issues |
| **Header special characters** | Header contains special characters (!@#$%^&* etc.); simpler names recommended |
| **Numeric-only header** | Header is only numbers; descriptive names recommended |
| **Long header name** | Header exceeds 100 characters |
| **Very long field** | Field is 2000-4000 characters; verify field mapping supports this length |
| **Empty key field** | First column (likely a key field) is empty; row may fail import |
| **Too many rows** | Over 1 million rows; may cause performance issues |
| **Many empty lines** | More than 10% of lines are empty; consider removing for cleaner data |
| **Too many columns** | More than 300 columns; may experience performance issues |
| **Leading/trailing whitespace in data** | Data fields have whitespace that may cause data quality issues |
| **HTML tags in data** | Data contains HTML markup |
| **HTML entities in data** | Data contains HTML entities like `&nbsp;`, `&quot;` |
| **Problematic characters** | Data contains smart quotes, em dashes, ellipsis, non-breaking spaces |

---

## Additional Features:

- **Auto-correction**: Generates corrected content with proper quoting, escaped characters, and cleaned data
- **Preview generation**: Creates a preview of first 10 data rows for review
- **Statistics**: Provides detailed stats (line count, column count, empty lines, max field length, etc.)
- **Row-level tracking**: Identifies specific problematic rows with suggested fixes


#### Pre-requisites:

1. Active NodeJS LTS (Long Term Support) version and associated supported NPM version.  (See https://nodejs.org)

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/SAP/csv-validator/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure
If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/SAP/csv-validator/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2026 SAP SE or an SAP affiliate company and csv-validator contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP/csv-validator).
