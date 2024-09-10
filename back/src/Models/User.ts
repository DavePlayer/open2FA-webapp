import { DataTypes, Model, Optional, Sequelize } from "sequelize";

// Define the attributes of the User model
export interface UserAttributes {
  id: number;
  name: string;
  password: string;
  isTwoFAon: boolean;
}

// Define creation attributes (making id optional for model creation)
export interface UserCreationAttributes
  extends Optional<UserAttributes, "id"> {}

// Extend the Sequelize Model class
export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public name!: string;
  public password!: string;
  public isTwoFAon!: boolean;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Define a function to initialize the model
export function initializeUserModel(sequelize: Sequelize): typeof User {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isTwoFAon: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "user",
      tableName: "users",
      timestamps: false, // If you want Sequelize to manage createdAt/updatedAt
    }
  );

  return User;
}