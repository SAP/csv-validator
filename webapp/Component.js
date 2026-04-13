sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "com/sap/validatecsv/model/models"
], function (UIComponent, Device, models) {
    "use strict";

    return UIComponent.extend("com.sap.validatecsv.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(models.createDeviceModel(), "device");
            
            // Initialize main model
            var oModel = new sap.ui.model.json.JSONModel({
                uploadedFile: null,
                validationResults: {
                    isValid: null,
                    encoding: "",
                    totalRows: 0,
                    invalidRows: []
                },
                csvData: []
            });
            this.setModel(oModel);
        }
    });
});