// Sequelize model: SubCategory
//   Child taxonomy entry belonging to a Category. Professionals pick one or
//   more sub-category ids on their profile.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `subcat-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const SubCategory = sequelize.define(
  'SubCategory',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    categoryId: { type: DataTypes.STRING(64), allowNull: false },
    // Optional parent sub-category id — supports a 2-tier taxonomy:
    // tier-1 sub-categories have parentSubCategoryId=null; tier-2
    // sub-categories point at their tier-1 parent. Currently used by
    // the Legal category (Civil Litigation → Property disputes etc.).
    parentSubCategoryId: { type: DataTypes.STRING(64), allowNull: true },
    name: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // When true, the sub-category appears in the home page
    // "Browse by area of expertise" section. Admin curates the list.
    featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'sub_categories',
    timestamps: true,
    indexes: [
      { fields: ['slug'], unique: true },
      { fields: ['categoryId'] },
      { fields: ['active'] },
      { fields: ['parentSubCategoryId'] },
    ],
  }
);

module.exports = SubCategory;
