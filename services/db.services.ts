const dbServices = {
  // Create a new document
  createDocument: async (model: any, data: any) => {
    return await model.create(data);
  },

  // Update a document by ID
  updateDocumentById: async (model: any, id: any, data: any) => {
    if (!id) return [0, []]; // Return if no ID

    const document = await model.findByPk(id);
    if (!document) return [0, []]; // Return if no document found

    await document.update(data);
    return [1, [document]]; // Return updated document
  },

  // Update documents based on a query
  updateDocument: async (model: any, query: any, data: any) => {
    return await model.update(data, { where: query, returning: true });
  },

  // Update one document based on a query
  updateOneDocument: async (model: any, query: any, data: any) => {
    return await model.update(data, { where: query, returning: true });
  },

  // Find a document by ID
  findById: async (model: any, id: any) => {
    if (id) {
      return await model.findByPk(id);
    }
    return null;
  },

  // Find one document and update it
  findOneAndUpdate: async (model: any, query: any, data: any) => {
    const instance = await model.findOne({ where: query });
    if (instance) {
      return await instance.update(data);
    }
    return null;
  },

  // Find one document and remove it
  findOneAndRemove: async (model: any, query: any) => {
    const instance = await model.findOne({ where: query });
    if (instance) {
      return await instance.destroy();
    }
    return null;
  },

  // Find a document by ID and remove it
  findByIdAndRemove: async (model: any, id: any) => {
    if (id) {
      const instance = await model.findByPk(id);
      if (instance) {
        return await instance.destroy();
      }
    }
    return null;
  },

  // Find documents based on a query
  findDocuments: async (model: any, query = {}) => {
    return await model.findAll({ where: query });
  },

  // Find one document based on a query
  findOneDocument: async (model: any, query = {}) => {
    return await model.findOne({ where: query });
  },

  // Count documents based on a query
  countDocuments: async (model: any, query = {}) => {
    return await model.count({ where: query });
  },

  // Remove a document by ID
  removeDocumentById: async (model: any, id: any) => {
    if (id) {
      const instance = await model.findByPk(id);
      if (instance) {
        return await instance.destroy();
      }
    }
    return null;
  },

  // Delete a document by ID
  deleteDocumentById: async (model: any, id: any) => {
    if (id) {
      return await model.destroy({ where: { id } });
    }
    return null;
  },

  // Delete documents based on a query
  deleteDocuments: async (model: any, query = {}) => {
    return await model.destroy({ where: query, truncate: true });
  },
};

export default dbServices;
