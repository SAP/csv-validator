sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/table/Column",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/Select",
    "sap/ui/core/Item",
    "validator/lib/csv-validator"
], function (Controller, MessageToast, Column, Text, Label, Select, Item, CSVValidator) {
    "use strict";

    return Controller.extend("com.sap.validatecsv.controller.Main", {

        onInit: function () {
            this.oModel = this.getOwnerComponent().getModel();
        },

        onFileChange: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            if (aFiles && aFiles.length > 0) {
                var oFile = aFiles[0];
                this.oModel.setProperty("/uploadedFile", oFile);

                // Set focus to Validate button
                var oValidateButton = this.byId("_IDGenButton");
                if (oValidateButton) {
                    setTimeout(function() {
                        oValidateButton.focus();
                    }, 100);
                }
            }
        },

        onFilenameLengthExceed: function(oEvent) {
            MessageToast.show("Event filenameLengthExceed triggered");
        },

        onFileSizeExceed: function(oEvent) {
            MessageToast.show("Event fileSizeExceed triggered");
        },

        onTypeMissmatch: function(oEvent) {
            MessageToast.show("Event typeMissmatch triggered");
        },

        onValidateFile: function () {
            var oFile = this.oModel.getProperty("/uploadedFile");
            if (!oFile) {
                MessageToast.show("Please select a file first");
                return;
            }

            this._validateCSVFile(oFile);
        },

        _validateCSVFile: async function (oFile) {
            try {
                const result = await CSVValidator.validateCSV(oFile);

                // Set validation results
                this.oModel.setProperty("/validationResults", result);

                // Process invalid rows - convert to array if needed
                if (result.invalidRows && Array.isArray(result.invalidRows)) {
                    this.oModel.setProperty("/validationResults/invalidRowsArray", result.invalidRows);
                    this.oModel.setProperty("/validationResults/filteredInvalidRows", result.invalidRows);
                } else {
                    this.oModel.setProperty("/validationResults/invalidRowsArray", []);
                    this.oModel.setProperty("/validationResults/filteredInvalidRows", []);
                }

                // Reset issue type filter
                this.oModel.setProperty("/selectedIssueType", "");

                // Populate issue type dropdown dynamically
                this._populateIssueTypeFilter(result.invalidRows);

                // Create preview table
                if (result.previewHeader && result.previewHeader.length > 0 &&
                    result.previewContent && result.previewContent.length > 0) {
                    this._createPreviewTable(result.previewHeader[0], result.previewContent);
                }

                // Show summary message
                if (result.isValid) {
                    MessageToast.show("Validation successful - No issues found");
                } else {
                    MessageToast.show(`Validation completed - ${result.errors.length} error(s) found`);
                }

            } catch (error) {
                MessageToast.show("Error during validation: " + error.message);
                console.error("Validation error:", error);
            }
        },

        _populateIssueTypeFilter: function(aInvalidRows) {
            if (!aInvalidRows || aInvalidRows.length === 0) return;

            // Get unique issue types
            var aIssueTypes = [];
            var oIssueTypeMap = {};

            aInvalidRows.forEach(function(oRow) {
                if (oRow.issueType && !oIssueTypeMap[oRow.issueType]) {
                    oIssueTypeMap[oRow.issueType] = true;
                    aIssueTypes.push(oRow.issueType);
                }
            });

            // Sort issue types
            aIssueTypes.sort();

            // Update dropdown
            var oSelect = this.byId("issueTypeFilter");
            if (oSelect) {
                oSelect.destroyItems();
                oSelect.addItem(new Item({ key: "", text: "All" }));
                aIssueTypes.forEach(function(sType) {
                    oSelect.addItem(new Item({ key: sType, text: sType }));
                });
            }
        },

        _createPreviewTable: function (aHeaders, cdata) {
            var oTable = this.byId("csvPreviewTable");
            
            // Clear existing columns
            oTable.destroyColumns();

            // Create columns based on headers
            for (var i = 0; i < aHeaders.length; i++) {
                var sHeader = aHeaders[i] || "Column" + (i + 1);
                var oColumn = new Column({
                    label: new Label({ text: sHeader }),
                    template: new Text({ 
                        text: "{" + sHeader + "}",
                        wrapping: false
                    })
                });
                oTable.addColumn(oColumn);
            }

            // Set the model property
            this.oModel.setProperty("/csvData", cdata);
        },

        onDownloadCorrected: function() {
            const oModel = this.getView().getModel();
            const oValidationResults = oModel.getProperty("/validationResults");
            const oFile = oModel.getProperty("/uploadedFile");
            
            if (!oValidationResults || !oValidationResults.correctedContent) {
                sap.m.MessageBox.error("No corrected content available");
                return;
            }

            // Create corrected file name
            const sFileName = oFile.name;
            const sCorrectedFileName = sFileName.replace('.csv', '_corrected.csv');
            
            // Create blob and download
            const blob = new Blob([oValidationResults.correctedContent], { 
                type: 'text/csv;charset=utf-8;' 
            });
            
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            
            link.setAttribute("href", url);
            link.setAttribute("download", sCorrectedFileName);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            MessageToast.show("Corrected file downloaded successfully");
        },

        onClearResults: function () {
            this.oModel.setProperty("/uploadedFile", null);
            this.oModel.setProperty("/validationResults", {
                isValid: null,
                encoding: "",
                totalRows: 0,
                errors: [],
                invalidRows: [],
                invalidRowsArray: [],
                filteredInvalidRows: []
            });
            this.oModel.setProperty("/csvData", []);
            this.oModel.setProperty("/selectedIssueType", "");

            // Clear upload collection
            var oUploadCollection = this.byId("uploadCollection");
            oUploadCollection.destroyItems();

            MessageToast.show("Results cleared");
        },

        onIssueTypeFilterChange: function(oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            this.oModel.setProperty("/selectedIssueType", sSelectedKey);

            var aAllRows = this.oModel.getProperty("/validationResults/invalidRowsArray");
            var aFilteredRows = aAllRows;

            if (sSelectedKey) {
                aFilteredRows = aAllRows.filter(function(oRow) {
                    return oRow.issueType === sSelectedKey;
                });
            }

            this.oModel.setProperty("/validationResults/filteredInvalidRows", aFilteredRows);
        },

        // Formatter to highlight HTML entities and tags in table
        formatHighlightedContent: function(sContent) {
            if (!sContent) return "";

            // First, escape basic HTML for security
            var sEscaped = sContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            // Highlight HTML entities (before we have them displayed)
            sEscaped = sEscaped.replace(/(&[a-zA-Z0-9]+;)/g, function(match) {
                return '<span class="highlightedIssue">' + match + '</span>';
            });

            // Highlight HTML tags (escaped)
            sEscaped = sEscaped.replace(/(&lt;[^&]*&gt;)/g, function(match) {
                return '<span class="highlightedIssue">' + match + '</span>';
            });

            return '<div style="padding: 4px; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; line-height: 1.5;">' + sEscaped + '</div>';
        },

        // Formatter for dialog with more prominent highlighting
        formatDialogHighlightedContent: function(sContent) {
            if (!sContent) return "";

            // First escape basic HTML for security
            var sEscaped = sContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            // Highlight HTML entities with yellow background
            sEscaped = sEscaped.replace(/(&[a-zA-Z0-9]+;)/g, function(match) {
                return '<span class="issueHighlight">' + match + '</span>';
            });

            // Highlight HTML tags
            sEscaped = sEscaped.replace(/(&lt;[^&]*&gt;)/g, function(match) {
                return '<span class="issueHighlight">' + match + '</span>';
            });

            return '<div style="word-wrap: break-word; white-space: pre-wrap; font-family: monospace; font-size: 0.9rem;">' + sEscaped + '</div>';
        },

        // Formatter for corrected content in dialog (no highlighting, just display)
        formatDialogCorrectedContent: function(sContent) {
            if (!sContent) return "";

            // First, remove escaped quotes \" and replace with nothing (to show (vertical) instead of ("vertical"))
            var sProcessed = sContent.replace(/\\"/g, '');

            // Now escape remaining HTML for security
            var sEscaped = sProcessed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return '<div style="word-wrap: break-word; white-space: pre-wrap; font-family: monospace; font-size: 0.9rem;">' + sEscaped + '</div>';
        },

        // Handle cell click to show detail dialog
        onCellClick: function(oEvent) {
            var oRowContext = oEvent.getParameter("rowBindingContext");
            if (oRowContext) {
                var oRowData = oRowContext.getObject();

                // Set selected row data
                this.oModel.setProperty("/selectedRow", oRowData);

                // Open dialog
                if (!this._oDialog) {
                    this._oDialog = this.byId("rowDetailDialog");
                }
                this._oDialog.open();
            }
        },

        // Handle row press to show detail dialog
        onRowPress: function(oEvent) {
            var oRow = oEvent.getParameter("row");
            var oContext = oRow.getBindingContext();
            var oRowData = oContext.getObject();

            // Set selected row data
            this.oModel.setProperty("/selectedRow", oRowData);

            // Open dialog
            if (!this._oDialog) {
                this._oDialog = this.byId("rowDetailDialog");
            }
            this._oDialog.open();
        },

        // Close detail dialog
        onCloseDialog: function() {
            if (this._oDialog) {
                this._oDialog.close();
            }
        },

        // Handle table filtering
        onFilterTable: function(oEvent) {
            var oTable = oEvent.getSource();
            var oColumn = oEvent.getParameter("column");
            var sFilterProperty = oColumn.getFilterProperty();

            // Special handling for Issue Type column - show dropdown
            if (sFilterProperty === "issueType") {
                this._showIssueTypeFilterDialog(oTable, oColumn);
                return;
            }

            // Default filter behavior for other columns
            var aFilters = [];
            var aCols = oTable.getColumns();

            for (var i = 0; i < aCols.length; i++) {
                var oCol = aCols[i];
                var sFilterValue = oCol.getFilterValue();
                var sColFilterProperty = oCol.getFilterProperty();

                if (sFilterValue && sColFilterProperty) {
                    aFilters.push(new sap.ui.model.Filter(
                        sColFilterProperty,
                        sap.ui.model.FilterOperator.Contains,
                        sFilterValue
                    ));
                }
            }

            var oBinding = oTable.getBinding("rows");
            if (oBinding) {
                oBinding.filter(aFilters, "Application");
            }
        },

        _showIssueTypeFilterDialog: function(oTable, oColumn) {
            var that = this;

            // Get unique issue types from the data
            var oBinding = oTable.getBinding("rows");
            var aData = oBinding.getContexts().map(function(oContext) {
                return oContext.getObject();
            });

            var aIssueTypes = [];
            var oIssueTypeMap = {};
            aData.forEach(function(oRow) {
                if (oRow.issueType && !oIssueTypeMap[oRow.issueType]) {
                    oIssueTypeMap[oRow.issueType] = true;
                    aIssueTypes.push(oRow.issueType);
                }
            });

            // Sort issue types
            aIssueTypes.sort();

            // Create dialog if not exists
            if (!this._filterDialog) {
                var oSelect = new Select({
                    id: this.createId("issueTypeSelect"),
                    width: "100%",
                    forceSelection: false
                });

                this._filterDialog = new sap.m.Dialog({
                    title: "Filter by Issue Type",
                    content: [
                        new sap.m.VBox({
                            items: [
                                new Label({ text: "Select Issue Type:" }),
                                oSelect
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Apply",
                        press: function() {
                            var sSelectedValue = oSelect.getSelectedKey();
                            if (sSelectedValue) {
                                oColumn.setFilterValue(sSelectedValue);
                                that._applyTableFilters(oTable);
                            }
                            that._filterDialog.close();
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Clear",
                        press: function() {
                            oColumn.setFilterValue("");
                            that._applyTableFilters(oTable);
                            that._filterDialog.close();
                        }
                    })
                });
            }

            // Update select items
            var oSelect = sap.ui.getCore().byId(this.createId("issueTypeSelect"));
            oSelect.destroyItems();
            oSelect.addItem(new Item({ key: "", text: "All" }));
            aIssueTypes.forEach(function(sType) {
                oSelect.addItem(new Item({ key: sType, text: sType }));
            });

            // Set current filter value
            oSelect.setSelectedKey(oColumn.getFilterValue() || "");

            this._filterDialog.open();
        },

        _applyTableFilters: function(oTable) {
            var aFilters = [];
            var aCols = oTable.getColumns();

            for (var i = 0; i < aCols.length; i++) {
                var oCol = aCols[i];
                var sFilterValue = oCol.getFilterValue();
                var sFilterProperty = oCol.getFilterProperty();

                if (sFilterValue && sFilterProperty) {
                    aFilters.push(new sap.ui.model.Filter(
                        sFilterProperty,
                        sap.ui.model.FilterOperator.Contains,
                        sFilterValue
                    ));
                }
            }

            var oBinding = oTable.getBinding("rows");
            if (oBinding) {
                oBinding.filter(aFilters, "Application");
            }
        }

    });
});
