class Category {
  constructor(input = {}) {
    this.id = input.id || null;
    this.name = input.name || "";
    this.description = input.description || null;
    this.active = input.active !== false;
  }
}

module.exports = {
  Category,
};
