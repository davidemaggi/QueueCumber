using LiteDB;
using QueueCumber.Models.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace QueueCumber.Data.Repositories
{
    public abstract class BaseRepository<T> : IBaseRepository<T> where T : QueueCumberBase
    {
        public IQueueCumberDataService _queueCumberDataService { get; }
        private readonly ILiteDatabase _db;
        public ILiteCollection<T> Collection { get; }

        protected BaseRepository(IQueueCumberDataService qds)
        {
            _queueCumberDataService = qds;
            _db = _queueCumberDataService.GetContext();
            Collection = _db.GetCollection<T>();
        }

        public virtual T Create(T entity)
        {

            var now = DateTime.UtcNow;
            entity.CreatedTime = now;
            entity.ModifiedTime = now;



            var newId = Collection.Insert(entity);
            return Collection.FindById(newId.AsInt32);
        }

        public virtual IEnumerable<T> All()
        {
            return Collection.FindAll();
        }

        public virtual T FindById(int id)
        {
            return Collection.FindById(id);
        }

        public virtual void Update(T entity)
        {

            var now = DateTime.UtcNow;
            entity.ModifiedTime = now;

            Collection.Upsert(entity);
        }

        public virtual bool Delete(int id)
        {
            return Collection.Delete(id);
        }
    }
}
