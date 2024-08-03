using QueueCumber.Drivers;
using QueueCumber.Models.Entities;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace QueueCumber.Core
{
    public interface IQueueCumberService
    {

        public void Connect(QueueCumberConnection connection);
        public ConnectionIntance? GetConnection(QueueCumberConnection connection);
        public ConnectionIntance? GetConnection(int id);

        public void Disconnect(QueueCumberConnection connection);
        public void Disconnect(int id);


    }
}
