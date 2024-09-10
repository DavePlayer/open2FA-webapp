import { DataTypes, Model, Optional, Sequelize } from "sequelize";

// Define the attributes of the User model
export interface UserAttributes {
  id: number;
  email: string;
  password: string;
  isTwoFAon: boolean;
  twoFaHash?: string | null;
  tempTwoFaHash?: string | null;
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
  public email!: string;
  public password!: string;
  public isTwoFAon!: boolean;
  public twoFaHash!: string | null;
  public tempTwoFaHash!: string | null;

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
      email: {
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
      twoFaHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tempTwoFaHash: {
        type: DataTypes.STRING,
        allowNull: true,
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
