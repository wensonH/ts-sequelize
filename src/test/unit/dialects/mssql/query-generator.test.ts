'use strict';

import * as _ from 'lodash';
import TableHints from '../../../../lib/dialects/mssql/table-hints';
import Support from '../../../support';
const expectsql = Support.expectsql;
const current = Support.sequelize;
const QueryGenerator = current.dialect.QueryGenerator;

if (current.dialect.name === 'mssql') {
  describe('[MSSQL Specific] QueryGenerator', () => {
    // Dialect would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
    QueryGenerator._dialect = current.dialect;

    it('getDefaultConstraintQuery', () => {
      expectsql(QueryGenerator.getDefaultConstraintQuery({tableName: 'myTable', schema: 'mySchema'}, 'myColumn'), {
        mssql: "SELECT name FROM SYS.DEFAULT_CONSTRAINTS WHERE PARENT_OBJECT_ID = OBJECT_ID('[mySchema].[myTable]', 'U') AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns" +
        " WHERE NAME = ('myColumn') AND object_id = OBJECT_ID('[mySchema].[myTable]', 'U'));"
      });
    });

    it('dropConstraintQuery', () => {
      expectsql(QueryGenerator.dropConstraintQuery({tableName: 'myTable', schema: 'mySchema'}, 'myConstraint'), {
        mssql: 'ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint];'
      });
    });

    it('bulkInsertQuery', () => {
      //normal cases
      expectsql(QueryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, {name: 'bar'}]), {
        mssql: "INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');"
      });

      expectsql(QueryGenerator.bulkInsertQuery('myTable', [{ username: 'username', firstName: 'firstName', lastName: 'lastName' }, { firstName: 'user1FirstName', lastName: 'user1LastName'}]), {
        mssql: "INSERT INTO [myTable] ([username],[firstName],[lastName]) VALUES (N'username',N'firstName',N'lastName'),(NULL,N'user1FirstName',N'user1LastName');"
      });

      expectsql(QueryGenerator.bulkInsertQuery('myTable', [{ firstName: 'firstName', lastName: 'lastName' }, { firstName: 'user1FirstName', lastName: 'user1LastName'}]), {
        mssql: "INSERT INTO [myTable] ([firstName],[lastName]) VALUES (N'firstName',N'lastName'),(N'user1FirstName',N'user1LastName');"
      });

      //Bulk Insert With autogenerated primary key
      const attributes = { id: { autoIncrement: true }};
      expectsql(QueryGenerator.bulkInsertQuery('myTable', [{ id: null }], {}, attributes), {
        mssql: 'INSERT INTO [myTable] DEFAULT VALUES'
      });
    });

    it('selectFromTableFragment', () => {
      const modifiedGen = _.clone(QueryGenerator);
      // Test newer versions first
      // Should be all the same since handling is done in addLimitAndOffset
      // for SQL Server 2012 and higher (>= v11.0.0)
      (modifiedGen as any).sequelize = {
        options: {
          databaseVersion: '11.0.0'
        }
      };

      // Base case
      expectsql(modifiedGen.selectFromTableFragment({}, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName', 'WHERE id=1'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With tableHint - nolock
      expectsql(modifiedGen.selectFromTableFragment({ tableHint: TableHints.NOLOCK }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName WITH (NOLOCK)'
      });

      // With tableHint - NOWAIT
      expectsql(modifiedGen.selectFromTableFragment({ tableHint: TableHints.NOWAIT }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName WITH (NOWAIT)'
      });

      // With limit
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With offset
      expectsql(modifiedGen.selectFromTableFragment({ offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With both limit and offset
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10, offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // Test older version (< v11.0.0)
      (modifiedGen as any).sequelize.options.databaseVersion = '10.0.0';

      // Base case
      expectsql(modifiedGen.selectFromTableFragment({}, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName', 'WHERE id=1'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With limit
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 10 id, name FROM myTable AS myOtherName'
      });

      // With offset
      expectsql(modifiedGen.selectFromTableFragment({ offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 100 PERCENT id, name FROM (SELECT * FROM (SELECT ROW_NUMBER() OVER (ORDER BY [id]) as row_num, *  FROM myTable AS myOtherName) AS myOtherName WHERE row_num > 10) AS myOtherName'
      });

      // With both limit and offset
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10, offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 100 PERCENT id, name FROM (SELECT TOP 10 * FROM (SELECT ROW_NUMBER() OVER (ORDER BY [id]) as row_num, *  FROM myTable AS myOtherName) AS myOtherName WHERE row_num > 10) AS myOtherName'
      });
    });

    it('getPrimaryKeyConstraintQuery', () => {
      expectsql(QueryGenerator.getPrimaryKeyConstraintQuery('myTable', 'myColumnName'), {
        mssql: 'SELECT K.TABLE_NAME AS tableName, K.COLUMN_NAME AS columnName, K.CONSTRAINT_NAME AS constraintName FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS C JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS K ON C.TABLE_NAME = K.TABLE_NAME AND C.CON'
        + 'STRAINT_CATALOG = K.CONSTRAINT_CATALOG AND C.CONSTRAINT_SCHEMA = K.CONSTRAINT_SCHEMA AND C.CONSTRAINT_NAME = K.CONSTRAINT_NAME WHERE C.CONSTRAINT_TYPE = \'PRIMARY KEY\' AND K.COLUMN_NAME = \'myColumnName\' AND K.TABLE_NAME = \'myTable\';'
      });
    });

    it('createSchema', () => {
      expectsql(QueryGenerator.createSchema('mySchema'), {
        mssql: 'IF NOT EXISTS (SELECT schema_name FROM information_schema.schemata WHERE schema_name = \'mySchema\' ) BEGIN EXEC sp_executesql N\'CREATE SCHEMA [mySchema] ;\' END;'
      });
    });

    it('showSchemasQuery', () => {
      expectsql(QueryGenerator.showSchemasQuery(), {
        mssql: 'SELECT "name" as "schema_name" FROM sys.schemas as s WHERE "s"."name" NOT IN ( \'INFORMATION_SCHEMA\', \'dbo\', \'guest\', \'sys\', \'archive\' ) AND "s"."name" NOT LIKE \'db_%\''
      });
    });

    it('versionQuery', () => {
      expectsql(QueryGenerator.versionQuery(), {
        mssql: "DECLARE @ms_ver NVARCHAR(20); SET @ms_ver = REVERSE(CONVERT(NVARCHAR(20), SERVERPROPERTY('ProductVersion'))); SELECT REVERSE(SUBSTRING(@ms_ver, CHARINDEX('.', @ms_ver)+1, 20)) AS 'version'"
      });
    });

    it('renameTableQuery', () => {
      expectsql(QueryGenerator.renameTableQuery('oldTableName', 'newTableName'), {
        mssql: 'EXEC sp_rename [oldTableName], [newTableName];'
      });
    });

    it('showTablesQuery', () => {
      expectsql(QueryGenerator.showTablesQuery(), {
        mssql: 'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES;'
      });
    });

    it('dropTableQuery', () => {
      expectsql(QueryGenerator.dropTableQuery('dirtyTable'), {
        mssql: "IF OBJECT_ID('[dirtyTable]', 'U') IS NOT NULL DROP TABLE [dirtyTable];"
      });
    });

    it('removeColumnQuery', () => {
      expectsql(QueryGenerator.removeColumnQuery('myTable', 'myColumn'), {
        mssql: 'ALTER TABLE [myTable] DROP COLUMN [myColumn];'
      });
    });

    it('quoteIdentifier', () => {
      expectsql(QueryGenerator.quoteIdentifier("'myTable'.'Test'"), {
        mssql: '[myTable.Test]'
      });
    });

    it('getForeignKeysQuery', () => {
      expectsql(QueryGenerator.getForeignKeysQuery('myTable'), {
        mssql: 'SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),'
        + ' columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM SYS.FOREIGN_KEY_COLUMNS FKC'
        + ' INNER JOIN SYS.OBJECTS OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN SYS.TABLES TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN SYS.COLUMNS COL ON COL.COLUMN_ID = PARENT_COLUMN_ID'
        + " AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN SYS.TABLES RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN SYS.COLUMNS RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable'"
      });

      expectsql(QueryGenerator.getForeignKeysQuery('myTable', 'myDatabase'), {
        mssql: "SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintCatalog = 'myDatabase', constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),"
        + " tableCatalog = 'myDatabase', columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedCatalog = 'myDatabase', referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME"
        + ' FROM SYS.FOREIGN_KEY_COLUMNS FKC INNER JOIN SYS.OBJECTS OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN SYS.TABLES TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN SYS.COLUMNS COL ON COL.COLUMN_ID = PARENT_COLUMN_ID'
        + " AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN SYS.TABLES RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN SYS.COLUMNS RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable'"
      });

      expectsql(QueryGenerator.getForeignKeysQuery({
        tableName: 'myTable',
        schema: 'mySchema'
      }, 'myDatabase'), {
        mssql: "SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintCatalog = 'myDatabase', constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),"
        + " tableCatalog = 'myDatabase', columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedCatalog = 'myDatabase', referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM SYS.FOREIGN_KEY_COLUMNS FKC"
        + ' INNER JOIN SYS.OBJECTS OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN SYS.TABLES TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN SYS.COLUMNS COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID INNER'
        + " JOIN SYS.TABLES RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN SYS.COLUMNS RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable' AND SCHEMA_NAME(TB.SCHEMA_ID) ='mySchema'"
      });
    });

    it('getForeignKeyQuery', () => {
      expectsql(QueryGenerator.getForeignKeyQuery('myTable', 'myColumn'), {
        mssql: 'SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), columnName = COL.NAME,'
        + ' referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM SYS.FOREIGN_KEY_COLUMNS FKC INNER JOIN SYS.OBJECTS OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID'
        + ' INNER JOIN SYS.TABLES TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN SYS.COLUMNS COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN SYS.TABLES RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID'
        + " INNER JOIN SYS.COLUMNS RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable' AND COL.NAME ='myColumn'"
      });
      expectsql(QueryGenerator.getForeignKeyQuery({
        tableName: 'myTable',
        schema: 'mySchema'
      }, 'myColumn'), {
        mssql: 'SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), columnName = COL.NAME,'
        + ' referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM SYS.FOREIGN_KEY_COLUMNS FKC INNER JOIN SYS.OBJECTS OBJ ON'
        + ' OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN SYS.TABLES TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN SYS.COLUMNS COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID'
        + ' INNER JOIN SYS.TABLES RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN SYS.COLUMNS RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID'
        + " WHERE TB.NAME ='myTable' AND COL.NAME ='myColumn' AND SCHEMA_NAME(TB.SCHEMA_ID) ='mySchema'"
      });
    });

    it('dropForeignKeyQuery', () => {
      expectsql(QueryGenerator.dropForeignKeyQuery('myTable', 'myColumnKey'), {
        mssql: 'ALTER TABLE [myTable] DROP [myColumnKey]'
      });
    });

    it('arithmeticQuery', () => {
      [{
        title: 'Should use the plus operator',
        arguments: ['+', 'myTable', { foo: 'bar' }, {}, {}],
        expectation: 'UPDATE myTable SET foo=foo+ \'bar\' '
      },
      {
        title: 'Should use the plus operator with where clause',
        arguments: ['+', 'myTable', { foo: 'bar' }, { bar: 'biz'}, {}],
        expectation: 'UPDATE myTable SET foo=foo+ \'bar\' WHERE bar = \'biz\''
      },
      {
        title: 'Should use the minus operator',
        arguments: ['-', 'myTable', { foo: 'bar' }, {}, {}],
        expectation: 'UPDATE myTable SET foo=foo- \'bar\' '
      },
      {
        title: 'Should use the minus operator with negative value',
        arguments: ['-', 'myTable', { foo: -1 }, {}, {}],
        expectation: 'UPDATE myTable SET foo=foo- -1 '
      },
      {
        title: 'Should use the minus operator with where clause',
        arguments: ['-', 'myTable', { foo: 'bar' }, { bar: 'biz'}, {}],
        expectation: 'UPDATE myTable SET foo=foo- \'bar\' WHERE bar = \'biz\''
      }].forEach(test => {
        it(test.title, () => {
          expectsql(QueryGenerator.arithmeticQuery.call(QueryGenerator, test.arguments), {
            mssql: test.expectation
          });
        });
      });
    });
  });
}
