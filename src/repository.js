const Convention = require('./convention')
const DataMapper = require('./dataMapper')
const Knex = require('knex')

const dependency = { convention: Convention, knex: Knex }

module.exports = class Repository {

    constructor(options) {
        const di = Object.assign({}, dependency, options.injection)
        this.convention = di.convention
        this.table = options.table
        this.schema = options.schema
        this.tableQualifiedName = this.schema ? `${this.schema}.${this.table}` : `${this.table}`
        this.entity = options.entity
        this.entityIDs = options.ids
        this.runner = di.knex(options.dbConfig)
        this.dataMapper = DataMapper.getFrom(this.entity, this.entityIDs)
    }

    mapFields() {
        const entity = this.entity
        this.dataMapper = DataMapper.getFrom(entity)
    }
    
    async findByID(ids) {
        const dataMapper = this.dataMapper
        const tableIDs = dataMapper.getTableIDs()
        const tableFields = dataMapper.getTableFields()

        const runner = this.runner(this.table)
        const parsedValue = Array.isArray(ids) ? ids : [ids]
        const ret = await runner.select(tableFields).whereIn(tableIDs[0],parsedValue)
        
        const entities = []

        for (const row of ret) {
            if (row === undefined) continue
            this.dataMapper.load(row)
            entities.push(this.entity.fromJSON(this.dataMapper))
        }

        return entities
    }

    async insert(entityInstance){
        const runner = this.runner(this.table)
        const ret = await runner.insert(entityInstance)
        return true
    }

    async persist(entityInstance) {

        const dataMapper = this.dataMapper
        const tableIDs = dataMapper.getTableIDs()
        const tableFields = dataMapper.getTableFields()
        const values = dataMapper.getValuesFromEntity(entityInstance)
        const placeholders = values.map(() => `?`).join(', ')
        const updateFields = 
            tableFields.filter((f) => !tableIDs.includes(f))
            .map((f) => `${f} = EXCLUDED.${f}`)
        let sql = `INSERT INTO ${this.tableQualifiedName} (${tableFields.join(', ')}) VALUES (${placeholders}) `
        sql += `ON CONFLICT (${tableIDs.join(', ')}) DO `
        sql += `UPDATE SET `
        sql += `${updateFields.join(', ')}`

        const ret = await this.query(sql, values)
        return true
    }


    async query(sql, values) {
        try {
            console.info("[SQL]", sql, " [VALUES]", values.toString())
            const runner = this.runner
            return await runner.raw(sql, values)
        } catch (error) {
            console.error(error)
            throw error
        }
    }
}