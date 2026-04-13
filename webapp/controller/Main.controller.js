sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/table/Column",
    "sap/m/Text",
    "sap/m/Label",
    "validator/lib/csv-validator"
], function (Controller, MessageToast, Column, Text, Label, CSVValidator) {
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
                } else {
                    this.oModel.setProperty("/validationResults/invalidRowsArray", []);
                }

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
                invalidRowsArray: []
            });
            this.oModel.setProperty("/csvData", []);
            
            // Clear upload collection
            var oUploadCollection = this.byId("uploadCollection");
            oUploadCollection.destroyItems();
            
            MessageToast.show("Results cleared");
        }
        
    });
});
