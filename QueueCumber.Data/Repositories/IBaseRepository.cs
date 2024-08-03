using QueueCumber.Models.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace QueueCumber.Data.Repositories
{
    public interface IBaseRepository<T> where T : QueueCumberBase
    {
        T Create(T data);
        IEnumerable<T> All();
        T FindById(int id);
        void Update(T entity);
        bool Delete(int id);
    }
}
