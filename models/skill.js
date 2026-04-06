import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

export const Skill = sequelize.define("Skill", {
  id: { type: DataTypes.UUID, primaryKey: true },

  name: DataTypes.STRING,
  capability: DataTypes.STRING,

  json: DataTypes.JSON,

  score: { type: DataTypes.FLOAT, defaultValue: 0.5 },
  usage_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  success_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  failure_count: { type: DataTypes.INTEGER, defaultValue: 0 },

  status: { type: DataTypes.STRING, defaultValue: "active" }, // active, inactive, deprecated
  
  last_evaluated_at: { type: DataTypes.DATE, defaultValue: null }, // For re-eval cooldown

  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  parent_id: DataTypes.UUID,

  last_used_at: DataTypes.DATE,
  created_at: DataTypes.DATE
});
